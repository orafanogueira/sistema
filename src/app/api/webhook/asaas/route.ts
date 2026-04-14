import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { AsaasWebhookEvent } from "@/lib/billing/asaas";

/**
 * Webhook Asaas - eventos de pagamento.
 * Configurar em Asaas > Integracoes > Webhooks:
 *   URL: https://app.gruponogueiramkt.com/api/webhook/asaas
 *
 * Principais eventos:
 *  PAYMENT_CREATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE,
 *  PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_CHARGEBACK_REQUESTED
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as AsaasWebhookEvent;
  const supabase = createServiceClient();

  const eventName = body?.event;
  const payment = body?.payment;
  if (!eventName) return NextResponse.json({ ok: false });

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
      await supabase.from("cobrancas").update(update).eq("asaas_payment_id", payment.id);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new NextResponse("Asaas webhook endpoint", { status: 200 });
}
