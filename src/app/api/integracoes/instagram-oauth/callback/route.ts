import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback do Instagram OAuth via Facebook Login.
 * 1. Troca code por short-lived token (Facebook Graph API)
 * 2. Troca por long-lived token
 * 3. Busca Instagram accounts diretamente via /me/instagram_accounts
 * 4. Tambem busca via Pages (/me/accounts -> instagram_business_account)
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

  // Coleta todas as contas IG de multiplas fontes
  const igAccountsMap = new Map<string, {
            id: string;
            username: string;
            fb_page_id: string;
            page_access_token: string;
  }>();

  // Fonte 1: Busca via Pages do usuario (/me/accounts)
  try {
            const pagesRes = await fetch(
                        `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&limit=100&access_token=${longToken}`
                      );
            const pagesJson = await pagesRes.json();
            const pages = pagesJson.data || [];

          for (const page of pages) {
                      const igAcc = page.instagram_business_account;
                      if (igAcc?.id) {
                                    igAccountsMap.set(igAcc.id, {
                                                    id: igAcc.id,
                                                    username: igAcc.username || "",
                                                    fb_page_id: page.id,
                                                    page_access_token: page.access_token || longToken,
                                    });
                      }
          }
            console.log(`Pages: ${pages.length}, IG via pages: ${igAccountsMap.size}`);
  } catch (e) {
            console.error("Erro buscando pages:", e);
  }

  // Fonte 2: Busca via /me/instagram_accounts (direto)
  try {
            const igRes = await fetch(
                        `https://graph.facebook.com/v20.0/me/instagram_accounts?fields=id,username,profile_picture_url&limit=100&access_token=${longToken}`
                      );
            const igJson = await igRes.json();
            const igAccounts = igJson.data || [];
            console.log(`IG direto: ${igAccounts.length}`, JSON.stringify(igJson).slice(0, 200));

          for (const acc of igAccounts) {
                      if (acc.id && !igAccountsMap.has(acc.id)) {
                                    igAccountsMap.set(acc.id, {
                                                    id: acc.id,
                                                    username: acc.username || "",
                                                    fb_page_id: "",
                                                    page_access_token: longToken,
                                    });
                      }
          }
  } catch (e) {
            console.error("Erro buscando instagram_accounts:", e);
  }

  // Fonte 3: Busca via businesses
  try {
            const bizRes = await fetch(
                        `https://graph.facebook.com/v20.0/me/businesses?fields=id,name,instagram_accounts{id,username}&limit=50&access_token=${longToken}`
                      );
            const bizJson = await bizRes.json();
            const businesses = bizJson.data || [];
            console.log(`Businesses: ${businesses.length}`);

          for (const biz of businesses) {
                      const bizIgAccounts = biz.instagram_accounts?.data || [];
                      for (const acc of bizIgAccounts) {
                                    if (acc.id && !igAccountsMap.has(acc.id)) {
                                                    igAccountsMap.set(acc.id, {
                                                                      id: acc.id,
                                                                      username: acc.username || "",
                                                                      fb_page_id: "",
                                                                      page_access_token: longToken,
                                                    });
                                    }
                      }
          }
  } catch (e) {
            console.error("Erro buscando businesses:", e);
  }

  console.log(`Total IG accounts encontradas: ${igAccountsMap.size}`);

  // Salva todas as contas encontradas
  for (const [igId, igData] of igAccountsMap) {
            const payload = {
                        tenant_id: m?.tenant_id,
                        ig_user_id: igId,
                        ig_username: igData.username,
                        fb_page_id: igData.fb_page_id,
                        page_access_token: igData.page_access_token,
                        is_active: true,
                        last_sync_at: new Date().toISOString(),
            };

          const { data: existing } = await supabase
              .from("instagram_accounts")
              .select("id")
              .eq("ig_user_id", igId)
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
