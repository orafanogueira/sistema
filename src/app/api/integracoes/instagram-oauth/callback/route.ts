import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback do Instagram OAuth via Facebook Login.
 * 1. Troca code por short-lived token (Facebook Graph API)
 * 2. Troca por long-lived token
 * 3. Busca Pages do usuario (/me/accounts)
 * 4. Para cada Page, verifica instagram_business_account vinculada
 * 5. Salva/atualiza cada conta IG em instagram_accounts
 * 6. Redireciona para /configuracoes/instagram
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

  const appId = process.env.META_APP_ID || "";
      const appSecret = process.env.META_APP_SECRET || "";
      const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/instagram-oauth/callback`;

  // 1. Troca code por short-lived token
  const tokenRes = await fetch(
          `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`
        );
      const tokenJson = await tokenRes.json();

  if (!tokenRes.ok || !tokenJson.access_token) {
          console.error("instagram-oauth callback erro token:", tokenJson);
          return NextResponse.redirect(
                    new URL(`/configuracoes/instagram?error=${encodeURIComponent(JSON.stringify(tokenJson))}`, req.url)
                  );
  }

  // 2. Troca por long-lived token
  const llRes = await fetch(
          `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenJson.access_token}`
        );
      const llJson = await llRes.json();
      const longToken = llJson.access_token || tokenJson.access_token;

  // 3. Busca Pages do usuario
  const pagesRes = await fetch(
          `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${longToken}`
        );
      const pagesJson = await pagesRes.json();

  const pages: Array<{
          id: string;
          name: string;
          access_token: string;
          instagram_business_account?: { id: string; username?: string };
  }> = pagesJson.data || [];

  // 4. Prepara para salvar no banco
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

  let connectedCount = 0;

  for (const page of pages) {
          const igAccount = page.instagram_business_account;
          if (!igAccount) continue;

        const payload = {
                  tenant_id: m?.tenant_id,
                  ig_user_id: igAccount.id,
                  ig_username: igAccount.username || "",
                  fb_page_id: page.id,
                  page_access_token: page.access_token || longToken,
                  is_active: true,
                  last_sync_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
            .from("instagram_accounts")
            .select("id")
            .eq("ig_user_id", igAccount.id)
            .maybeSingle();

        if (existing) {
                  await supabase.from("instagram_accounts").update(payload).eq("id", existing.id);
        } else {
                  await supabase.from("instagram_accounts").insert({ ...payload, connected_at: new Date().toISOString() });
        }
          connectedCount++;
  }

  return NextResponse.redirect(
          new URL(`/configuracoes/instagram?connected=${connectedCount}`, req.url)
        );
}
