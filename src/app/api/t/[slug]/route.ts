import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseUA, getClientIP, getClientCountry } from "@/lib/rastreamento/device";

/**
 * Short link tracker publico.
 * GET /api/t/[slug]?fbclid=xxx&gclid=yyy&utm_source=...
 *
 * Registra o clique com metadata + redireciona pro destino.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const supabase = createServiceClient();

  const { data: link } = await supabase
    .from("short_links")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!link) {
    return new NextResponse("Link nao encontrado", { status: 404 });
  }

  const q = url.searchParams;
  const utm = {
    source: q.get("utm_source"),
    medium: q.get("utm_medium"),
    campaign: q.get("utm_campaign"),
    term: q.get("utm_term"),
    content: q.get("utm_content"),
  };
  const hasUtm = Object.values(utm).some((v) => v);
  const device = parseUA(req.headers.get("user-agent"));
  const ip = getClientIP(req.headers);
  const country = getClientCountry(req.headers);

  // session_id via cookie (pra correlacionar com pageviews anteriores)
  const existingSession = req.headers.get("cookie")?.match(/gn_sid=([^;]+)/)?.[1];
  const session_id = existingSession || crypto.randomUUID();

  await supabase.from("link_clicks").insert({
    short_link_id: link.id,
    cliente_id: link.cliente_id,
    utm: hasUtm ? utm : {},
    fbclid: q.get("fbclid"),
    gclid: q.get("gclid"),
    ttclid: q.get("ttclid"),
    referrer: req.headers.get("referer"),
    user_agent: req.headers.get("user-agent"),
    ip,
    country,
    session_id,
    device_type: device.device_type,
    os: device.os,
    browser: device.browser,
  });

  // incrementa total (fire-and-forget)
  await supabase.rpc("noop", {}).catch(() => {});
  await supabase.from("short_links")
    .update({ clicks_total: (link.clicks_total || 0) + 1 })
    .eq("id", link.id);

  // Monta destino final com UTMs preservadas
  const destUrl = new URL(link.destination_url);
  if (q.get("fbclid")) destUrl.searchParams.set("fbclid", q.get("fbclid")!);
  if (q.get("gclid")) destUrl.searchParams.set("gclid", q.get("gclid")!);

  const response = NextResponse.redirect(destUrl.toString(), 302);
  response.cookies.set("gn_sid", session_id, { maxAge: 30 * 86400, path: "/", sameSite: "lax" });
  return response;
}
