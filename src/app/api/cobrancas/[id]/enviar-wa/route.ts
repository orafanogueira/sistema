import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ZAPIClient } from "@/lib/integrations/zapi";
import { formatBRL } from "@/lib/utils";

/**
 * Envia PIX/boleto dessa cobranca via WhatsApp pro cliente.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("*,cliente:clientes(nome,contato_whatsapp)")
    .eq("id", id).maybeSingle();
  if (!cobranca) return new NextResponse("nao encontrada", { status: 404 });

  const cliente = cobranca.cliente as { nome?: string; contato_whatsapp?: string } | null;
  if (!cliente?.contato_whatsapp) return new NextResponse("cliente sem WhatsApp", { status: 400 });

  try {
    const zapi = new ZAPIClient();
    const nome = cliente.nome;
    const valor = formatBRL(Number(cobranca.valor));
    const vencimento = new Date(cobranca.due_date).toLocaleDateString("pt-BR");
    const desc = cobranca.descricao || "Mensalidade";

    let msg = `Ola ${nome}! 👋\n\nCobranca *${desc}* no valor de *${valor}* com vencimento em *${vencimento}*.\n\n`;

    if (cobranca.forma_pagamento === "pix" && cobranca.pix_copy_paste) {
      msg += `💠 *PIX COPIA E COLA:*\n\`\`\`${cobranca.pix_copy_paste}\`\`\`\n\n`;
    }
    if (cobranca.asaas_bank_slip_url) {
      msg += `🧾 Boleto: ${cobranca.asaas_bank_slip_url}\n\n`;
    }
    if (cobranca.asaas_invoice_url) {
      msg += `🔗 Fatura online: ${cobranca.asaas_invoice_url}\n\n`;
    }
    msg += "Qualquer duvida, e so responder aqui.";

    await zapi.sendText(cliente.contato_whatsapp, msg);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
