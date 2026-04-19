import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google-calendar/client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  try {
    const state = user.id;
    const url = getAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e: unknown) {
    return NextResponse.json({
      erro: e instanceof Error ? e.message : "erro",
      como_configurar: "Configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e NEXT_PUBLIC_APP_URL no Vercel",
    }, { status: 500 });
  }
}
