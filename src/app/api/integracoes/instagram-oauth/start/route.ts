import { NextResponse } from "next/server";

/**
 * Inicia OAuth do Instagram via Facebook Login para Empresas.
 * Usa o app Facebook (META_APP_ID) com Facebook OAuth endpoint.
 * Scopes validos para Facebook Login:
 *   pages_show_list, pages_read_engagement, business_management,
 *   instagram_content_publish, instagram_manage_comments,
 *   instagram_manage_messages
 * O callback troca o code por token e descobre as contas IG Business vinculadas.
 */
export async function GET(req: Request) {
          const url = new URL(req.url);
          const state = url.searchParams.get("state") || "";

  const appId = process.env.META_APP_ID;
          const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/instagram-oauth/callback`;

  const scope = [
              "pages_show_list",
              "pages_read_engagement",
              "business_management",
              "instagram_content_publish",
              "instagram_manage_comments",
              "instagram_manage_messages",
            ].join(",");

  if (!appId) {
              return new NextResponse("META_APP_ID nao configurado", { status: 400 });
  }

  const authUrl =
              `https://www.facebook.com/v20.0/dialog/oauth` +
              `?client_id=${appId}` +
              `&redirect_uri=${encodeURIComponent(redirect)}` +
              `&scope=${encodeURIComponent(scope)}` +
              `&response_type=code` +
              (state ? `&state=${encodeURIComponent(state)}` : "");

  return NextResponse.redirect(authUrl);
}
