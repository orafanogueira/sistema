/**
 * Google Analytics 4 (Data API v1beta) - stub.
 * Requer GOOGLE_CLIENT_ID/SECRET + refresh_token com scope analytics.readonly.
 */
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export async function ga4Report(opts: {
  propertyId: string;
  since: string;
  until: string;
  refreshToken: string;
}) {
  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GA4_CLIENT_EMAIL,
      private_key: process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
  });
  const [response] = await client.runReport({
    property: `properties/${opts.propertyId}`,
    dateRanges: [{ startDate: opts.since, endDate: opts.until }],
    metrics: [
      { name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" },
      { name: "conversions" }, { name: "totalRevenue" },
    ],
    dimensions: [{ name: "date" }, { name: "sessionSourceMedium" }],
  });
  return response;
}
