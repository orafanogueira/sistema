import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ClicksignWebhookPayload } from "@/lib/contratos/clicksign";

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

  const { data: contrato } = await supabase.from("contratos").select("id,cliente_id,tenant_id")
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
    // Contrato completamente assinado
    await supabase.from("contratos").update({
      status: "assinado",
      signed_at: new Date().toISOString(),
    }).eq("id", contrato.id);

    // TODO: auto-gerar cobranca apos assinatura (se valor > 0)
  }

  if (eventName === "refuse") {
    await supabase.from("contratos").update({ status: "rejeitado" }).eq("id", contrato.id);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new NextResponse("Clicksign webhook endpoint", { status: 200 });
}
