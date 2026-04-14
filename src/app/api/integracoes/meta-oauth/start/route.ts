import { NextResponse } from "next/server";

/**
 * Inicia OAuth do Meta (Pages + Messenger + IG + WhatsApp).
 * Requer META_APP_ID e META_APP_SECRET. Configure redirect no painel do app.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cliente = url.searchParams.get("cliente") || "";
  const appId = process.env.META_APP_ID;
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/meta-oauth/callback`;
  const state = Buffer.from(JSON.stringify({ cliente })).toString("base64url");
  const scope = [
    "pages_messaging",
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_manage_messages",
    "business_management",
    "whatsapp_business_messaging",
    "whatsapp_business_management",
    "ads_read",
    "ads_management",
  ].join(",");
  if (!appId) return new NextResponse("META_APP_ID nao configurado", { status: 400 });
  const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}&scope=${scope}`;
  return NextResponse.redirect(authUrl);
}
