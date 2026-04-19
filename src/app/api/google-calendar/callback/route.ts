import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getUserEmail } from "@/lib/google-calendar/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user_id
  const error = url.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  if (error) {
    return NextResponse.redirect(`${appUrl}/configuracoes/calendar?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/configuracoes/calendar?error=missing_code`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getUserEmail(tokens.access_token);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== state) {
      return NextResponse.redirect(`${appUrl}/configuracoes/calendar?error=invalid_state`);
    }

    const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!m) return NextResponse.redirect(`${appUrl}/configuracoes/calendar?error=no_tenant`);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // upsert — 1 conexão por usuário
    await supabase.from("google_calendar_tokens")
      .upsert({
        tenant_id: m.tenant_id,
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        email,
        calendar_id: "primary",
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    return NextResponse.redirect(`${appUrl}/configuracoes/calendar?success=1&email=${encodeURIComponent(email || "")}`);
  } catch (e: unknown) {
    return NextResponse.redirect(`${appUrl}/configuracoes/calendar?error=${encodeURIComponent(e instanceof Error ? e.message : "erro")}`);
  }
}
