/**
 * Google Ads integration - stub.
 * Requer: GOOGLE_ADS_DEVELOPER_TOKEN, OAuth (client id/secret/refresh), customer_id.
 * Docs: https://developers.google.com/google-ads/api/docs/start
 */
import { GoogleAdsApi } from "google-ads-api";

export function getGoogleAdsClient() {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!developerToken || !clientId || !clientSecret) {
    throw new Error("Google Ads nao configurado - preencha GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET");
  }
  return new GoogleAdsApi({ client_id: clientId, client_secret: clientSecret, developer_token: developerToken });
}

export async function googleAdsInsights(opts: {
  customerId: string;
  refreshToken: string;
  since: string;
  until: string;
  loginCustomerId?: string;
}) {
  const client = getGoogleAdsClient();
  const customer = client.Customer({
    customer_id: opts.customerId.replace(/-/g, ""),
    refresh_token: opts.refreshToken,
    login_customer_id: opts.loginCustomerId?.replace(/-/g, ""),
  });
  const rows = await customer.query(`
    SELECT campaign.id, campaign.name, campaign.status,
           metrics.impressions, metrics.clicks, metrics.cost_micros,
           metrics.conversions, metrics.ctr, metrics.average_cpc,
           segments.date
    FROM campaign
    WHERE segments.date BETWEEN '${opts.since}' AND '${opts.until}'
    ORDER BY segments.date DESC
  `);
  return rows.map((r) => ({
    date: r.segments?.date,
    campaign_id: r.campaign?.id?.toString(),
    campaign_name: r.campaign?.name,
    impressions: Number(r.metrics?.impressions || 0),
    clicks: Number(r.metrics?.clicks || 0),
    spend: Number(r.metrics?.cost_micros || 0) / 1_000_000,
    conversions: Number(r.metrics?.conversions || 0),
    ctr: Number(r.metrics?.ctr || 0) * 100,
    cpc: Number(r.metrics?.average_cpc || 0) / 1_000_000,
  }));
}
