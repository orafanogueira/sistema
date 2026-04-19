import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractInstagramProfile, extractInstagramFollowers } from "@/lib/extratores/apify";

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { username, max_followers, tipo } = await req.json();
  if (!username) return new NextResponse("username obrigatório", { status: 400 });

  try {
    if (tipo === "perfil") {
      const profiles = await extractInstagramProfile(username);
      return NextResponse.json({ profiles, total: profiles.length });
    }

    // default: seguidores
    const followers = await extractInstagramFollowers(username, max_followers || 500);
    return NextResponse.json({ followers, total: followers.length });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
