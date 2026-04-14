import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MetaAdsClient, extractAction } from "@/lib/integrations/meta-ads";

/** Retorna metricas em tempo real da conta Meta Ads de um cliente. */
export async function GET(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const url = new URL(req.url);
  const range = url.searchParams.get("range") || "30d";

  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("id,nome").eq("id", clienteId).maybeSingle();
  if (!cliente) return new NextResponse("cliente nao encontrado", { status: 404 });

  const { data: integ } = await supabase.from("integrations")
    .select("*").eq("cliente_id", clienteId).eq("provider", "meta_ads").eq("is_connected", true).maybeSingle();
  if (!integ) return new NextResponse("integracao meta_ads nao conectada", { status: 400 });

  const token = integ.access_token || process.env.META_ACCESS_TOKEN;
  if (!token) return new NextResponse("sem access_token", { status: 400 });
  const accountId = integ.account_id!;

  const today = new Date();
  const since = new Date(today);
  if (range === "30d") since.setDate(today.getDate() - 30);
  else if (range === "90d") since.setDate(today.getDate() - 90);
  else since.setMonth(today.getMonth() - 12);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const client = new MetaAdsClient(token, accountId);

  const [insights, campaignInsights, monthly] = await Promise.all([
    client.insights({ since: iso(since), until: iso(today), level: "account" }),
    client.insights({ since: iso(since), until: iso(today), level: "campaign" }),
    client.insightsMonthly({ since: iso(since), until: iso(today) }),
  ]);

  const total = insights[0] || { spend: "0", clicks: 0, impressions: 0, actions: [], cost_per_action_type: [] } as unknown as typeof insights[0];
  const leadsTotal = extractAction(total as unknown as Parameters<typeof extractAction>[0], "complete_registration")
    || extractAction(total as unknown as Parameters<typeof extractAction>[0], "offsite_conversion.fb_pixel_custom");

  const spend = Number(total.spend || 0);
  const clicks = Number(total.clicks || 0);
  const impressions = Number(total.impressions || 0);

  const totals = {
    spend, clicks, impressions, leads: leadsTotal,
    ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
    cpc: clicks > 0 ? (spend / clicks) : 0,
    cpa: leadsTotal > 0 ? (spend / leadsTotal) : 0,
  };

  const monthlyParsed = monthly.map((m) => ({
    month: (m.date_start || "").slice(0, 7),
    spend: Number(m.spend || 0),
    clicks: Number(m.clicks || 0),
    leads: extractAction(m, "complete_registration") || extractAction(m, "offsite_conversion.fb_pixel_custom"),
  }));

  const campaigns = campaignInsights.map((c) => {
    const lead = extractAction(c, "complete_registration") || extractAction(c, "offsite_conversion.fb_pixel_custom");
    const sp = Number(c.spend || 0);
    return {
      name: c.campaign_name || "-",
      spend: sp, clicks: Number(c.clicks || 0), cadastros: lead,
      cpa: lead > 0 ? sp / lead : 0,
    };
  }).sort((a, b) => b.spend - a.spend);

  return NextResponse.json({ totals, monthly: monthlyParsed, campaigns });
}
