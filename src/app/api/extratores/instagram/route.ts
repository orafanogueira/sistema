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

    const target = max_followers || 500;

    // aceita múltiplos @ separados por vírgula/espaço/nova linha
    // dica pro usuário: quanto mais perfis concorrentes, maior a base de seguidores com contato
    const usernames = username
      .split(/[,;\s\n]+/)
      .map((u: string) => u.trim())
      .filter(Boolean);

    // extrai de todos e junta (dedup por username)
    const rawMap = new Map<string, Awaited<ReturnType<typeof extractInstagramFollowers>>[number]>();
    for (const u of usernames) {
      try {
        // oversample 30x quando só com contato (3-5% dos perfis têm contato público)
        const perProfileTarget = only_with_contact
          ? Math.ceil((target * 30) / usernames.length)
          : Math.ceil(target / usernames.length);
        const list = await extractInstagramFollowers(u, perProfileTarget);
        for (const f of list) {
          if (!rawMap.has(f.username)) rawMap.set(f.username, f);
        }
      } catch {}
    }
    const rawFollowers = Array.from(rawMap.values());

    // sem enriquecimento: retorna direto
    if (!enrich || rawFollowers.length === 0) {
      return NextResponse.json({
        followers: rawFollowers.slice(0, target),
        total: Math.min(rawFollowers.length, target),
        enriched: false,
        extracted_raw: rawFollowers.length,
        usernames_used: usernames,
      });
    }

    // com enriquecimento: processa em ondas se filtro "só com contato"
    if (only_with_contact) {
      const withContact: typeof rawFollowers = [];
      const waveSize = 50;
      let scanned = 0;

      for (let i = 0; i < rawFollowers.length && withContact.length < target; i += waveSize) {
        const wave = rawFollowers.slice(i, i + waveSize);
        scanned += wave.length;
        const enrichedWave = await enrichFollowersWithContact(wave, { onlyWithContact: true });
        withContact.push(...enrichedWave);
        if (withContact.length >= target) break;
      }

      const final = withContact.slice(0, target);
      return NextResponse.json({
        followers: final,
        total: final.length,
        with_email: final.filter((f) => f.email).length,
        with_phone: final.filter((f) => f.phone).length,
        enriched: true,
        extracted_raw: rawFollowers.length,
        scanned_profiles: scanned,
        conversion_rate: scanned > 0 ? ((final.length / scanned) * 100).toFixed(1) + "%" : "0%",
        usernames_used: usernames,
      });
    }

    // enriquecimento sem filtro: pega target diretamente
    const toEnrich = rawFollowers.slice(0, target);
    const enriched = await enrichFollowersWithContact(toEnrich, { onlyWithContact: false });
    return NextResponse.json({
      followers: enriched,
      total: enriched.length,
      with_email: enriched.filter((f) => f.email).length,
      with_phone: enriched.filter((f) => f.phone).length,
      enriched: true,
      extracted_raw: rawFollowers.length,
      usernames_used: usernames,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
