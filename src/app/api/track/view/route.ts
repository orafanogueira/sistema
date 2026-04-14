import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/rastreamento/device";

/**
 * Pixel invisivel - script JS do cliente posta AQUI.
 * Captura fbclid, gclid, UTMs ANTES do usuario clicar em WhatsApp.
 *
 * O snippet JS que o cliente cola no site esta em /api/track/script/[cliente_token]
 */
export async function POST(req: Request) {
  const supabase = createServiceClient();
  const body = await req.json().catch(() => ({}));

  const { cliente_token, session_id, url, path, title, fbclid, gclid, ttclid, utm, referrer } = body;

  if (!cliente_token || !session_id) {
    return new NextResponse("params obrigatorios faltando", { status: 400 });
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, tenant_id")
    .eq("webhook_token", cliente_token)
    .maybeSingle();
  if (!cliente) return new NextResponse("token invalido", { status: 404 });

  await supabase.from("page_views").insert({
    tenant_id: cliente.tenant_id,
    cliente_id: cliente.id,
    url: url || req.headers.get("referer") || "",
    path: path,
    title: title,
    fbclid: fbclid,
    gclid: gclid,
    ttclid: ttclid,
    utm: utm || {},
    session_id: session_id,
    user_agent: req.headers.get("user-agent"),
    ip: getClientIP(req.headers),
    referrer: referrer,
  });

  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
