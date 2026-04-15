import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ClicksignWebhookPayload } from "@/lib/contratos/clicksign";
import {
  asaasCreateCustomer, asaasFindCustomerByCpfCnpj,
  asaasCreatePayment, asaasCreateSubscription, asaasGetPixQrCode,
  type AsaasCycle,
} from "@/lib/billing/asaas";

const CYCLE_MAP: Record<string, AsaasCycle> = {
  mensal: "MONTHLY", trimestral: "QUARTERLY", semestral: "SEMIANNUALLY", anual: "YEARLY",
};

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Webhook Clicksign - recebe eventos de assinatura.
 * Configurar em Clicksign > API > Webhooks > POST https://app.gruponogueiramkt.com/api/webhook/clicksign
 *
 * Eventos:
 *  - sign: signatario assinou
 *  - document_signed: todos assinaram
 *  - refuse: recusou
 *  - deadline: prazo expirou
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ClicksignWebhookPayload;
  const supabase = createServiceClient();

  const eventName = body?.event?.name;
  const docKey = body?.document?.key;
  if (!eventName || !docKey) return NextResponse.json({ ok: false, reason: "payload invalido" });

  const { data: contrato } = await supabase.from("contratos")
    .select("id,cliente_id,tenant_id,valor,forma_pagamento,parcelas,titulo,status")
    .eq("clicksign_document_key", docKey).maybeSingle();
  if (!contrato) return NextResponse.json({ ok: false, reason: "contrato nao encontrado" });

  await supabase.from("contrato_eventos").insert({
    contrato_id: contrato.id, type: eventName, metadata: body as unknown as Record<string, unknown>,
  });

  if (eventName === "sign") {
    const signers = body.signers || [];
    for (const s of signers) {
      if (s.signed_at) {
        await supabase.from("contrato_signatarios")
          .update({ signed_at: s.signed_at })
          .eq("contrato_id", contrato.id).eq("clicksign_signer_key", s.key);
      }
    }
  }

  if (eventName === "document_signed" || body?.document?.status === "closed") {
    // Contrato completamente assinado — so gera cobranca na 1a vez
    if (contrato.status !== "assinado") {
      await supabase.from("contratos").update({
        status: "assinado",
        signed_at: new Date().toISOString(),
      }).eq("id", contrato.id);

      await autoGerarCobranca(supabase, contrato);
    }
  }

  if (eventName === "refuse") {
    await supabase.from("contratos").update({ status: "rejeitado" }).eq("id", contrato.id);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new NextResponse("Clicksign webhook endpoint", { status: 200 });
}

interface ContratoRow {
  id: string; cliente_id: string | null; tenant_id: string;
  valor: number | null; forma_pagamento: string | null; parcelas: number | null;
  titulo: string; status: string;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

async function autoGerarCobranca(supabase: ServiceClient, contrato: ContratoRow) {
  const valor = Number(contrato.valor || 0);
  if (!contrato.cliente_id || valor <= 0) return;

  const { data: cliente } = await supabase.from("clientes")
    .select("id,nome,contato_email,contato_whatsapp")
    .eq("id", contrato.cliente_id).maybeSingle();
  if (!cliente) return;

  // CPF/CNPJ pode vir do contrato (campos_preenchidos) ou signatarios
  const { data: signer } = await supabase.from("contrato_signatarios")
    .select("cpf").eq("contrato_id", contrato.id).limit(1).maybeSingle();
  const cpfCnpj = ((signer?.cpf || "") as string).replace(/\D/g, "") || undefined;

  try {
    let customer = cpfCnpj ? await asaasFindCustomerByCpfCnpj(cpfCnpj) : null;
    if (!customer) {
      customer = await asaasCreateCustomer({
        name: cliente.nome,
        email: (cliente.contato_email as string) || undefined,
        mobilePhone: (cliente.contato_whatsapp as string) || undefined,
        cpfCnpj,
        externalReference: cliente.id,
      });
    }

    const forma = (contrato.forma_pagamento || "unico").toLowerCase();
    const cycle = CYCLE_MAP[forma];
    const descricao = `Contrato: ${contrato.titulo}`;

    if (cycle) {
      // Assinatura recorrente
      const sub = await asaasCreateSubscription({
        customer: customer.id,
        billingType: "PIX",
        value: valor,
        nextDueDate: addDays(7),
        cycle,
        description: descricao,
        externalReference: contrato.id,
      });
      await supabase.from("assinaturas").insert({
        tenant_id: contrato.tenant_id,
        cliente_id: contrato.cliente_id,
        contrato_id: contrato.id,
        descricao,
        valor_mensal: valor,
        ciclo: cycle,
        forma_pagamento: "pix",
        active: true,
        asaas_subscription_id: sub.id,
      });
    } else {
      // Pagamento unico (ou parcelado)
      const parcelas = Number(contrato.parcelas || 1);
      const payment = await asaasCreatePayment({
        customer: customer.id,
        billingType: "PIX",
        value: parcelas > 1 ? valor / parcelas : valor,
        installmentCount: parcelas > 1 ? parcelas : undefined,
        installmentValue: parcelas > 1 ? valor / parcelas : undefined,
        dueDate: addDays(7),
        description: descricao,
        externalReference: contrato.id,
      });
      let pix_copy_paste: string | null = null;
      let pix_qrcode_image: string | null = null;
      try {
        const qr = await asaasGetPixQrCode(payment.id);
        pix_copy_paste = qr.payload;
        pix_qrcode_image = qr.encodedImage;
      } catch { /* ignora */ }
      await supabase.from("cobrancas").insert({
        tenant_id: contrato.tenant_id,
        cliente_id: contrato.cliente_id,
        contrato_id: contrato.id,
        descricao,
        valor,
        forma_pagamento: "pix",
        status: "pendente",
        due_date: addDays(7),
        asaas_payment_id: payment.id,
        asaas_invoice_url: (payment as { invoiceUrl?: string }).invoiceUrl || null,
        pix_copy_paste, pix_qrcode_image,
      });
    }

    await supabase.from("contrato_eventos").insert({
      contrato_id: contrato.id, type: "cobranca_gerada",
      metadata: { valor, forma: cycle || "unico" },
    });
  } catch (e: unknown) {
    await supabase.from("contrato_eventos").insert({
      contrato_id: contrato.id, type: "cobranca_erro",
      metadata: { error: e instanceof Error ? e.message : String(e) },
    });
  }
}
