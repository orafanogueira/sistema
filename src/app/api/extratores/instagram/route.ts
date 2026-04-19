import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractInstagramProfile,
  extractInstagramFollowers,
  enrichFollowersWithContact,
} from "@/lib/extratores/apify";

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const {
    username,
    max_followers,
    tipo,
    enrich,
    only_with_contact,
  }: {
    username: string;
    max_followers?: number;
    tipo?: string;
    enrich?: boolean;
    only_with_contact?: boolean;
  } = await req.json();
  if (!username) return new NextResponse("username obrigatório", { status: 400 });

  try {
    if (tipo === "perfil") {
      const profiles = await extractInstagramProfile(username);
      return NextResponse.json({ profiles, total: profiles.length });
    }

    // default: seguidores
    const followers = await extractInstagramFollowers(username, max_followers || 500);

    // se pediu enriquecimento (email/telefone), faz segunda passada
    if (enrich && followers.length > 0) {
      const enriched = await enrichFollowersWithContact(followers, {
        onlyWithContact: only_with_contact,
      });
      return NextResponse.json({
        followers: enriched,
        total: enriched.length,
        with_email: enriched.filter((f) => f.email).length,
        with_phone: enriched.filter((f) => f.phone).length,
        enriched: true,
      });
    }

    return NextResponse.json({ followers, total: followers.length, enriched: false });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
