/**
 * Meta Conversion API - envia eventos pro Meta Pixel via server-to-server.
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */
import { createHash } from "crypto";

const GRAPH = "https://graph.facebook.com";
const VERSION = process.env.META_API_VERSION || "v20.0";

export interface CAPIUserData {
  email?: string | null;
  phone?: string | null;
  nome?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  country?: string | null;
  fbclid?: string | null;
  fbp?: string | null;     // cookie _fbp
  fbc?: string | null;     // cookie _fbc
  client_ip_address?: string | null;
  client_user_agent?: string | null;
  external_id?: string | null; // id do lead (pra dedup)
}

export interface CAPIEventOptions {
  pixel_id: string;
  access_token: string;
  event_name: string;        // Contact, Lead, Schedule, CompleteRegistration, Purchase, ou custom
  event_id: string;          // pra dedup com browser pixel
  event_time?: number;       // unix timestamp
  event_source_url?: string;
  action_source?: "website" | "chat" | "email" | "phone_call" | "physical_store" | "system_generated";
  user_data: CAPIUserData;
  custom_data?: {
    value?: number;
    currency?: string;
    content_name?: string;
    content_type?: string;
    content_ids?: string[];
  };
  test_event_code?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function hashIfExists(v: string | null | undefined): string | undefined {
  return v ? sha256(v) : undefined;
}

function normalizePhone(p: string | null | undefined): string | undefined {
  if (!p) return undefined;
  const digits = p.replace(/\D/g, "");
  return digits || undefined;
}

export async function sendMetaCAPI(opts: CAPIEventOptions) {
  const fbc = opts.user_data.fbc ||
    (opts.user_data.fbclid ? `fb.1.${Date.now()}.${opts.user_data.fbclid}` : undefined);

  const ud: Record<string, unknown> = {
    em: hashIfExists(opts.user_data.email),
    ph: hashIfExists(normalizePhone(opts.user_data.phone)),
    fn: hashIfExists(opts.user_data.first_name || opts.user_data.nome?.split(" ")[0]),
    ln: hashIfExists(opts.user_data.last_name || opts.user_data.nome?.split(" ").slice(1).join(" ")),
    ct: hashIfExists(opts.user_data.cidade),
    st: hashIfExists(opts.user_data.estado),
    zp: hashIfExists(opts.user_data.cep),
    country: hashIfExists(opts.user_data.country || "BR"),
    external_id: hashIfExists(opts.user_data.external_id),
    fbp: opts.user_data.fbp || undefined,
    fbc: fbc,
    client_ip_address: opts.user_data.client_ip_address || undefined,
    client_user_agent: opts.user_data.client_user_agent || undefined,
  };

  // remove campos undefined
  for (const k of Object.keys(ud)) if (ud[k] === undefined) delete ud[k];

  const body = {
    data: [{
      event_name: opts.event_name,
      event_time: opts.event_time || Math.floor(Date.now() / 1000),
      event_id: opts.event_id,
      event_source_url: opts.event_source_url,
      action_source: opts.action_source || "chat",
      user_data: ud,
      custom_data: opts.custom_data ? {
        currency: opts.custom_data.currency || "BRL",
        value: opts.custom_data.value,
        content_name: opts.custom_data.content_name,
        content_type: opts.custom_data.content_type,
        content_ids: opts.custom_data.content_ids,
      } : undefined,
    }],
    test_event_code: opts.test_event_code,
    access_token: opts.access_token,
  };

  const res = await fetch(`${GRAPH}/${VERSION}/${opts.pixel_id}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Meta CAPI ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
}
