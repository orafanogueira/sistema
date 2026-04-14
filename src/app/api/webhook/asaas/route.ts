import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { AsaasWebhookEvent } from "@/lib/billing/asaas";

/**
 * Webhook Asaas - eventos de pagamento.
 * Configurar em Asaas > Integracoes > Webhooks:
 *   URL: https://app.gruponogueiramkt.com/api/webhook/asaas
 *
 * Se configurado com token de autenticacao, o Asaas envia o token no header
 * `asaas-access-token`. Validamos contra ASAAS_WEBHOOK_TOKEN (se env existe).
 *
 * Principais eventos:
 *  PAYMENT_CREATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE,
 *  PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_CHARGEBACK_REQUESTED
 */
export async function POST(req: Request) {
  // log pra debug (remover depois de validar)
  console.log("[ASAAS WEBHOOK] hit. headers.asaas-access-token present:", !!req.headers.get("asaas-access-token"));

  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expectedToken) {
    const gotToken = req.headers.get("asaas-access-token");
    if (gotToken !== expectedToken) {
      console.log("[ASAAS WEBHOOK] token invalido");
      return new NextResponse("invalid webhook token", { status: 401 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as AsaasWebhookEvent;
  const supabase = createServiceClient();

  const eventName = body?.event;
  const payment = body?.payment;
  console.log("[ASAAS WEBHOOK] event:", eventName, "payment.id:", payment?.id);

  if (!eventName) return NextResponse.json({ ok: false, reason: "no event" });

  if (payment?.id) {
    let status: string | null = null;
    let paid_at: string | null = null;
    if (eventName === "PAYMENT_CONFIRMED" || eventName === "PAYMENT_RECEIVED") {
      status = "paga"; paid_at = new Date().toISOString();
    } else if (eventName === "PAYMENT_OVERDUE") {
      status = "vencida";
    } else if (eventName === "PAYMENT_DELETED") {
      status = "cancelada";
    } else if (eventName === "PAYMENT_REFUNDED") {
      status = "reembolsada";
    }

    if (status) {
      const update: Record<string, unknown> = { status };
      if (paid_at) update.paid_at = paid_at;
      const { error } = await supabase.from("cobrancas")
        .update(update).eq("asaas_payment_id", payment.id);
      if (error) console.log("[ASAAS WEBHOOK] db error:", error.message);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new NextResponse("Asaas webhook endpoint", { status: 200 });
}
