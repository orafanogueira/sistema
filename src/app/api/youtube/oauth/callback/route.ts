import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Callback do OAuth Google/YouTube — troca code por tokens e salva */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || ""}/youtube?error=oauth_denied`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || ""}/youtube?error=oauth_config`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const redirectUri = `${baseUrl}/api/youtube/oauth/callback`;

  // troca code por tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/youtube?error=token_failed`);
  }

  const tokens = await tokenRes.json();

  // pega info do canal
  let channelName = "Meu Canal";
  try {
    const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { "Authorization": `Bearer ${tokens.access_token}` },
    });
    if (chRes.ok) {
      const chData = await chRes.json();
      channelName = chData.items?.[0]?.snippet?.title || "Meu Canal";
    }
  } catch {}

  // salva no Supabase
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${baseUrl}/login`);

  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return NextResponse.redirect(`${baseUrl}/youtube?error=no_tenant`);

  // service client pra bypass RLS
  const service = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // upsert integration
  const { data: existing } = await service.from("integrations")
    .select("id").eq("tenant_id", m.tenant_id).eq("provider", "youtube").maybeSingle();

  if (existing) {
    await service.from("integrations").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      account_name: channelName,
      is_connected: true,
      extra: { token_type: tokens.token_type, expires_in: tokens.expires_in, scope: tokens.scope },
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await service.from("integrations").insert({
      tenant_id: m.tenant_id,
      provider: "youtube",
      account_name: channelName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      is_connected: true,
      extra: { token_type: tokens.token_type, expires_in: tokens.expires_in, scope: tokens.scope },
    });
  }

  return NextResponse.redirect(`${baseUrl}/youtube?connected=true`);
}
