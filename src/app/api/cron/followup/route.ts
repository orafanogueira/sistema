import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ZAPIClient } from "@/lib/integrations/zapi";
import { gmailSend } from "@/lib/integrations/google-oauth";

/**
 * Vercel Cron - roda a cada 5 minutos.
 * Busca followup_runs com status=scheduled e scheduled_for <= now, envia e marca como sent.
 * Configurar em vercel.json:
 *   { "crons": [{ "path": "/api/cron/followup", "schedule": "*\/5 * * * *" }] }
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date().toISOString();
  const { data: runs } = await supabase
    .from("followup_runs")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .limit(20);

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const r of runs || []) {
    try {
      if (r.channel === "whatsapp") {
        const zapi = new ZAPIClient();
        await zapi.sendText(r.recipient, r.body);
      } else if (r.channel === "email") {
        const { data: integ } = await supabase
          .from("integrations").select("refresh_token")
          .eq("tenant_id", r.tenant_id).eq("provider", "gmail").eq("is_connected", true).maybeSingle();
        if (!integ?.refresh_token) throw new Error("Gmail nao conectado");
        await gmailSend({ refreshToken: integ.refresh_token, to: r.recipient, subject: r.subject || "(sem assunto)", html: r.body });
      } else {
        throw new Error(`Canal nao suportado: ${r.channel}`);
      }
      await supabase.from("followup_runs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
      results.push({ id: r.id, ok: true });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Erro";
      await supabase.from("followup_runs").update({ status: "failed", error }).eq("id", r.id);
      results.push({ id: r.id, ok: false, error });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
