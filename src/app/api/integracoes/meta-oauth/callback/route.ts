import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code) return new NextResponse("missing code", { status: 400 });

  const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/meta-oauth/callback`;
  const tokenRes = await fetch(
    `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`
  );
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) return new NextResponse(JSON.stringify(tokenJson), { status: 400 });

  // Troca por long-lived token
  const llRes = await fetch(
    `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${tokenJson.access_token}`
  );
  const llJson = await llRes.json();
  const longToken = llJson.access_token || tokenJson.access_token;

  const state = stateRaw ? JSON.parse(Buffer.from(stateRaw, "base64url").toString()) : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();

  const providers = ["messenger", "instagram", "whatsapp_cloud"] as const;
  for (const p of providers) {
    await supabase.from("integrations").upsert({
      tenant_id: m?.tenant_id,
      cliente_id: state.cliente || null,
      provider: p,
      access_token: longToken,
      is_connected: true,
      last_sync_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,cliente_id,provider" });
  }

  return NextResponse.redirect(new URL("/integracoes?connected=meta", req.url));
}
