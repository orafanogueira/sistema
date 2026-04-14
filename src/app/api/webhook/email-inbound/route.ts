import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestLead } from "@/lib/leads/ingest";
import { parseEmailLead } from "@/lib/leads/parsers";

/**
 * Endpoint para Resend Inbound (ou outro provider de email parser).
 * Configurar no Resend:
 *   - Domain: leads.gruponogueiramkt.com
 *   - Inbound webhook: https://gruponogueiramkt.com/api/webhook/email-inbound
 *
 * Cada cliente tem um email_inbound unico (ex: loja-athos@leads.gruponogueiramkt.com).
 * Quando o portal manda lead pra esse email, o Resend posta aqui.
 */
export async function POST(req: Request) {
  const supabase = await createServiceClient();
  const body = await req.json();

  // Resend envia: { from, to, subject, text, html, attachments? }
  const to = (Array.isArray(body.to) ? body.to[0] : body.to) as string;
  const subject = body.subject as string;
  const text = (body.text || body.html || "") as string;
  const from = body.from as string;

  if (!to) return new NextResponse("missing to", { status: 400 });

  // identifica cliente pelo email destino
  const emailLower = to.toLowerCase().trim();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id,tenant_id,nome")
    .eq("email_inbound", emailLower).maybeSingle();

  if (!cliente) {
    // log e retorna 200 pra nao retentar
    console.warn(`Email inbound sem cliente: ${emailLower}`);
    return NextResponse.json({ ok: false, reason: "cliente nao encontrado" });
  }

  const fullText = `${subject || ""}\n\n${text}`;
  const lead = parseEmailLead(fullText);
  lead.origem_detalhe = lead.origem_detalhe || `email de ${from}`;

  try {
    const created = await ingestLead({ supabase, tenant_id: cliente.tenant_id, cliente_id: cliente.id, lead });
    return NextResponse.json({ ok: true, lead_id: created.id });
  } catch (e: unknown) {
    return new NextResponse(`falha: ${e instanceof Error ? e.message : "erro"}`, { status: 500 });
  }
}
