/**
 * Detector simples de device/OS/browser a partir do User-Agent.
 * Evita dependencia externa pra performance em edge.
 */

export interface DeviceInfo {
  device_type: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
}

export function parseUA(ua: string | null | undefined): DeviceInfo {
  const u = (ua || "").toLowerCase();

  let device_type: DeviceInfo["device_type"] = "desktop";
  if (/ipad|tablet/.test(u)) device_type = "tablet";
  else if (/mobi|android.+mobile|iphone|ipod|blackberry|windows phone/.test(u)) device_type = "mobile";

  let os = "outro";
  if (/windows nt/.test(u)) os = "Windows";
  else if (/mac os x/.test(u)) os = /iphone|ipad|ipod/.test(u) ? "iOS" : "macOS";
  else if (/android/.test(u)) os = "Android";
  else if (/linux/.test(u)) os = "Linux";

  let browser = "outro";
  if (/samsungbrowser/.test(u)) browser = "Samsung Internet";
  else if (/edg\//.test(u)) browser = "Edge";
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = "Chrome";
  else if (/firefox\//.test(u)) browser = "Firefox";
  else if (/safari\//.test(u) && !/chrome|edg/.test(u)) browser = "Safari";
  else if (/opera|opr\//.test(u)) browser = "Opera";

  return { device_type, os, browser };
}

/** Extrai IP cliente de headers da Vercel/proxies. */
export function getClientIP(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    null
  );
}

/** Extrai pais do header CF-IPCountry se vier. */
export function getClientCountry(headers: Headers): string | null {
  return headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || null;
}
