import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { MetaAdsClient, extractAction } from "@/lib/integrations/meta-ads";

/**
 * Sync diario de metricas dos clientes conectados ao Meta Ads.
 * Configurar em vercel.json: { "crons": [{ "path": "/api/cron/sync-metrics", "schedule": "0 4 * * *" }] }
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = await createServiceClient();
  const { data: integs } = await supabase
    .from("integrations").select("*")
    .eq("provider", "meta_ads").eq("is_connected", true);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let synced = 0;

  for (const integ of integs || []) {
    const token = integ.access_token || process.env.META_ACCESS_TOKEN;
    if (!token || !integ.account_id || !integ.cliente_id) continue;
    try {
      const client = new MetaAdsClient(token, integ.account_id);
      const rows = await client.insights({ since: yesterday, until: yesterday, level: "campaign" });
      for (const r of rows) {
        const leads = extractAction(r, "complete_registration") || extractAction(r, "offsite_conversion.fb_pixel_custom");
        await supabase.from("metrics_daily").upsert({
          cliente_id: integ.cliente_id, provider: "meta_ads",
          date: yesterday,
          campaign_id: (r as unknown as { campaign_id?: string }).campaign_id || "acct",
          impressions: Number(r.impressions || 0),
          clicks: Number(r.clicks || 0),
          spend: Number(r.spend || 0),
          leads,
          conversions: leads,
          extra: { campaign_name: r.campaign_name },
        }, { onConflict: "cliente_id,provider,date,campaign_id" });
      }
      await supabase.from("integrations").update({ last_sync_at: new Date().toISOString() }).eq("id", integ.id);
      synced++;
    } catch {
      continue;
    }
  }

  return NextResponse.json({ synced });
}
