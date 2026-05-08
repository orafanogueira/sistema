import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback do Instagram Business Login OAuth.
 * 1. Troca o code por short-lived token (api.instagram.com/oauth/access_token)
 * 2. Troca por long-lived token (graph.facebook.com/v20.0/oauth/access_token)
 * 3. Busca todas as IG Business accounts do usuario (via linked_ig_account)
 * 4. Salva/atualiza cada conta em instagram_accounts
 * 5. Redireciona para /configuracoes/instagram
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const errorParam = url.searchParams.get("error");

    if (errorParam || !code) {
          const msg = url.searchParams.get("error_description") || "OAuth cancelado ou erro desconhecido";
          return NextResponse.redirect(
                  new URL(`/configuracoes/instagram?error=${encodeURIComponent(msg)}`, req.url)
                );
        }

    const appId = process.env.META_IG_APP_ID || "1508869680625199";
    const appSecret = process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET || "";
    const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/instagram-oauth/callback`;

    // 1. Troca code por short-lived user access token
    const tokenFormData = new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          grant_type: "authorization_code",
          redirect_uri: redirect,
          code,
        });

    const shortTokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenFormData.toString(),
        });
    const shortTokenJson = await shortTokenRes.json();

    if (!shortTokenRes.ok || !shortTokenJson.access_token) {
          console.error("instagram-oauth callback erro short token:", shortTokenJson);
          return NextResponse.redirect(
                  new URL(`/configuracoes/instagram?error=${encodeURIComponent(JSON.stringify(shortTokenJson))}`, req.url)
                );
        }

    const shortToken = shortTokenJson.access_token;

    // 2. Troca por long-lived token
    const llRes = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
        );
    const llJson = await llRes.json();
    const longToken = llJson.access_token || shortToken;

    // 3. Busca dados do usuario IG (ig_user_id, username)
    const meRes = await fetch(
          `https://graph.instagram.com/v20.0/me?fields=id,username&access_token=${longToken}`
        );
    const meJson = await meRes.json();
    const igUserId = meJson.id || shortTokenJson.user_id?.toString();
    const igUsername = meJson.username || "";

    if (!igUserId) {
          return NextResponse.redirect(
                  new URL(`/configuracoes/instagram?error=nao_foi_possivel_obter_ig_user_id`, req.url)
                );
        }

    // 4. Salva no banco
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
          return NextResponse.redirect(new URL("/login", req.url));
        }
    const { data: m } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const payload = {
          tenant_id: m?.tenant_id,
          ig_user_id: igUserId,
          ig_username: igUsername,
          page_access_token: longToken,
          is_active: true,
          last_sync_at: new Date().toISOString(),
        };

    const { data: existing } = await supabase
      .from("instagram_accounts")
      .select("id")
      .eq("ig_user_id", igUserId)
      .maybeSingle();

    if (existing) {
          await supabase.from("instagram_accounts").update(payload).eq("id", existing.id);
        } else {
          await supabase.from("instagram_accounts").insert({ ...payload, connected_at: new Date().toISOString() });
        }

    return NextResponse.redirect(
          new URL("/configuracoes/instagram?connected=true", req.url)
        );
  }
