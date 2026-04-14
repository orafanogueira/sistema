import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMetaCAPI } from "@/lib/rastreamento/meta-capi";

/**
 * Cron - processa fila de pixel_events pending.
 * Dispara Meta CAPI ou registra pra export Google Offline.
 * Schedule: a cada 2 minutos (Vercel Pro), 5 min no Free.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: pending } = await supabase
    .from("pixel_events")
    .select("*")
    .eq("status", "pending")
    .limit(50)
    .order("created_at", { ascending: true });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const ev of pending || []) {
    try {
      if (ev.provider === "meta_capi") {
        const { data: cfg } = await supabase.from("pixel_config")
          .select("meta_pixel_id, meta_access_token, meta_test_event_code")
          .eq("cliente_id", ev.cliente_id).maybeSingle();
        if (!cfg?.meta_pixel_id || !cfg?.meta_access_token) {
          throw new Error("pixel_config incompleto pro cliente");
        }
        const p = (ev.payload as Record<string, unknown>) || {};
        const resp = await sendMetaCAPI({
          pixel_id: cfg.meta_pixel_id,
          access_token: cfg.meta_access_token,
          test_event_code: cfg.meta_test_event_code || undefined,
          event_name: ev.event_name,
          event_id: ev.external_event_id || ev.id,
          user_data: {
            email: (p.email as string) || null,
            phone: (p.telefone as string) || null,
            nome: (p.nome as string) || null,
            cidade: (p.cidade as string) || null,
            estado: (p.estado as string) || null,
            fbclid: (p.fbclid as string) || null,
            client_ip_address: (p.ip as string) || null,
            client_user_agent: (p.user_agent as string) || null,
            external_id: ev.lead_id || undefined,
          },
          custom_data: ev.value ? { value: Number(ev.value), currency: ev.currency || "BRL" } : undefined,
        });
        await supabase.from("pixel_events").update({
          status: "sent", response: resp, sent_at: new Date().toISOString(),
        }).eq("id", ev.id);
        results.push({ id: ev.id, ok: true });
      } else if (ev.provider === "google_offline") {
        // Apenas marca como 'sent' - pro fluxo CSV o admin faz export manual.
        // Quando Google Ads API Standard for aprovado, faz call API real aqui.
        await supabase.from("pixel_events")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", ev.id);
        results.push({ id: ev.id, ok: true });
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "erro";
      await supabase.from("pixel_events").update({ status: "failed", error: errMsg }).eq("id", ev.id);
      results.push({ id: ev.id, ok: false, error: errMsg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
