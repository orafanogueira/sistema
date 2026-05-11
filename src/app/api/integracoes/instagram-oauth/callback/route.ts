import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
          const url = new URL(req.url);
          const code = url.searchParams.get("code");
          const errorParam = url.searchParams.get("error");
          const debug = url.searchParams.get("debug") === "1";

  if (errorParam || !code) {
              const msg = url.searchParams.get("error_description") || "OAuth cancelado";
              return NextResponse.redirect(
                            new URL(`/configuracoes/instagram?error=${encodeURIComponent(msg)}`, req.url)
                          );
  }

  const appId = process.env.META_APP_ID || "";
          const appSecret = process.env.META_APP_SECRET || "";
          const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/instagram-oauth/callback`;

  // 1. Token
  const tokenRes = await fetch(
              `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`
            );
          const tokenJson = await tokenRes.json();
          if (!tokenJson.access_token) {
                      return NextResponse.redirect(
                                    new URL(`/configuracoes/instagram?error=${encodeURIComponent(JSON.stringify(tokenJson))}`, req.url)
                                  );
          }

  // 2. Long-lived token
  const llRes = await fetch(
              `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenJson.access_token}`
            );
          const llJson = await llRes.json();
          const longToken = llJson.access_token || tokenJson.access_token;

  const debugInfo: Record<string, unknown> = {};

  // 3. Pages
  const pagesRes = await fetch(
              `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=200&access_token=${longToken}`
            );
          const pagesJson = await pagesRes.json();
          debugInfo.pages_count = pagesJson.data?.length ?? 0;
          debugInfo.pages_error = pagesJson.error;
          const pages = pagesJson.data || [];

  // 4. IG via businesses
  const bizRes = await fetch(
              `https://graph.facebook.com/v20.0/me/businesses?fields=id,name,instagram_accounts{id,username}&access_token=${longToken}`
            );
          const bizJson = await bizRes.json();
          debugInfo.biz_count = bizJson.data?.length ?? 0;
          debugInfo.biz_error = bizJson.error;
          debugInfo.biz_sample = JSON.stringify(bizJson).slice(0, 500);

  // 5. IG direto
  const igRes = await fetch(
              `https://graph.facebook.com/v20.0/me?fields=id,instagram_accounts{id,username}&access_token=${longToken}`
            );
          const igJson = await igRes.json();
          debugInfo.ig_me = JSON.stringify(igJson).slice(0, 500);

  if (debug) {
              return NextResponse.json({
                            token_ok: !!longToken,
                            ...debugInfo,
                            pages_with_ig: pages.filter((p: { instagram_business_account?: unknown }) => p.instagram_business_account).length,
              });
  }

  // Salvar
  const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: m } = await supabase
            .from("memberships")
            .select("tenant_id")
            .eq("user_id", user.id)
            .maybeSingle();

  let connectedCount = 0;
          const saved = new Set<string>();

  // Pages -> IG
  for (const page of pages) {
              const ig = page.instagram_business_account;
              if (!ig?.id || saved.has(ig.id)) continue;
              saved.add(ig.id);
              const payload = {
                            tenant_id: m?.tenant_id,
                            ig_user_id: ig.id,
                            ig_username: ig.username || "",
                            fb_page_id: page.id,
                            page_access_token: page.access_token || longToken,
                            is_active: true,
                            last_sync_at: new Date().toISOString(),
              };
              const { data: ex } = await supabase.from("instagram_accounts").select("id").eq("ig_user_id", ig.id).maybeSingle();
              if (ex) await supabase.from("instagram_accounts").update(payload).eq("id", ex.id);
              else await supabase.from("instagram_accounts").insert({ ...payload, connected_at: new Date().toISOString() });
              connectedCount++;
  }

  // Business -> IG
  for (const biz of bizJson.data || []) {
              for (const ig of biz.instagram_accounts?.data || []) {
                            if (!ig?.id || saved.has(ig.id)) continue;
                            saved.add(ig.id);
                            const payload = {
                                            tenant_id: m?.tenant_id,
                                            ig_user_id: ig.id,
                                            ig_username: ig.username || "",
                                            fb_page_id: "",
                                            page_access_token: longToken,
                                            is_active: true,
                                            last_sync_at: new Date().toISOString(),
                            };
                            const { data: ex } = await supabase.from("instagram_accounts").select("id").eq("ig_user_id", ig.id).maybeSingle();
                            if (ex) await supabase.from("instagram_accounts").update(payload).eq("id", ex.id);
                            else await supabase.from("instagram_accounts").insert({ ...payload, connected_at: new Date().toISOString() });
                            connectedCount++;
              }
  }

  return NextResponse.redirect(
              new URL(`/configuracoes/instagram?connected=${connectedCount}`, req.url)
            );
}
