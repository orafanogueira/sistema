/**
 * Google Ads - Offline Conversions via CSV upload.
 * Formato: https://support.google.com/google-ads/answer/7014069
 *
 * Tambem suporta chamada via Google Ads API (futuro - exige dev token Standard).
 */

export interface OfflineConversionRow {
  google_click_id: string;     // GCLID
  conversion_name: string;     // Nome exato da conversao configurada no Google Ads
  conversion_time: string;     // Formato: "YYYY-MM-DD HH:MM:SS+03:00"
  conversion_value?: number;
  conversion_currency?: string;
}

export function generateOfflineCSV(rows: OfflineConversionRow[]): string {
  const header = [
    "Parameters:TimeZone=-03:00",
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
  ].join("\n");

  const body = rows.map((r) => [
    r.google_click_id,
    `"${r.conversion_name.replace(/"/g, '""')}"`,
    r.conversion_time,
    r.conversion_value?.toFixed(2) || "",
    r.conversion_currency || "BRL",
  ].join(",")).join("\n");

  return header + "\n" + body + "\n";
}

export function formatConversionTimeBR(date: Date = new Date()): string {
  // Formato aceito: YYYY-MM-DD HH:MM:SS-03:00
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const M = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours() - 3 < 0 ? date.getUTCHours() - 3 + 24 : date.getUTCHours() - 3);
  const m = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${M}-${d} ${h}:${m}:${s}-03:00`;
}
