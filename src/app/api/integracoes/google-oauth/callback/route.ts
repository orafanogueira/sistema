import { NextResponse } from "next/server";
import { googleExchangeCode } from "@/lib/integrations/google-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code) return new NextResponse("missing code", { status: 400 });

  const tokens = await googleExchangeCode(code);
  const state = stateRaw ? JSON.parse(Buffer.from(stateRaw, "base64url").toString()) : {};

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();

  // Persist como google_ads / ga4 / gmail / calendar / gtm usando o mesmo refresh_token
  const providers = ["google_ads", "ga4", "google_calendar", "gmail", "gtm"] as const;
  for (const p of providers) {
    await supabase.from("integrations").upsert({
      tenant_id: m?.tenant_id,
      cliente_id: state.cliente || null,
      provider: p,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      is_connected: true,
      last_sync_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,cliente_id,provider" });
  }

  return NextResponse.redirect(new URL("/integracoes?connected=google", req.url));
}
