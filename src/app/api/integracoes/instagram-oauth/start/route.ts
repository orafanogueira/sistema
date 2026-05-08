import { NextResponse } from "next/server";

/**
 * Inicia OAuth do Instagram Business Login.
 * Usa Instagram app separado (META_IG_APP_ID) com Instagram OAuth endpoint.
 * Suporta scopes: instagram_business_basic, instagram_business_content_publish,
 *   instagram_business_manage_comments, instagram_business_manage_messages
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const state = url.searchParams.get("state") || "";

    const appId = process.env.META_IG_APP_ID || "1508869680625199";
    const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/instagram-oauth/callback`;

    const scope = [
          "instagram_business_basic",
          "instagram_business_content_publish",
          "instagram_business_manage_comments",
          "instagram_business_manage_messages",
        ].join(",");

    if (!appId) {
          return new NextResponse("META_IG_APP_ID nao configurado", { status: 400 });
        }

    const authUrl =
      `https://www.instagram.com/oauth/authorize` +
      `?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirect)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=code` +
      (state ? `&state=${encodeURIComponent(state)}` : "");

    return NextResponse.redirect(authUrl);
  }
