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

    // quando filtra "só com contato", precisamos superextrair (5-15% dos perfis têm contato)
    // pega até 10x mais seguidores e vai enriquecendo em ondas até atingir o alvo
    const extractMultiplier = only_with_contact ? 10 : 1;
    const rawFollowers = await extractInstagramFollowers(username, target * extractMultiplier);

    // sem enriquecimento: retorna direto
    if (!enrich || rawFollowers.length === 0) {
      return NextResponse.json({
        followers: rawFollowers.slice(0, target),
        total: Math.min(rawFollowers.length, target),
        enriched: false,
      });
    }

    // com enriquecimento: processa em ondas se filtro "só com contato"
    if (only_with_contact) {
      const withContact: typeof rawFollowers = [];
      const waveSize = 100; // enriquecer 100 por vez

      for (let i = 0; i < rawFollowers.length && withContact.length < target; i += waveSize) {
        const wave = rawFollowers.slice(i, i + waveSize);
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
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
