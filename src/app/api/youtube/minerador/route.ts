import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchChannels, getChannels, getRecentVideos } from "@/lib/youtube/data-api";
import { interestOverTime } from "@/lib/youtube/trends";

export const maxDuration = 120;   // pesquisa pode demorar

/**
 * Input: { categoria, pais, min_inscritos, max_inscritos, max_videos }
 * Output: { pesquisa_id, canais: [...] }
 *
 * Fluxo:
 *  1. YouTube search por categoria (ate 50 canais)
 *  2. Pega stats de cada canal (inscritos, videos, views)
 *  3. Filtra: monetizados (>1000 insc) + poucos videos (<max_videos)
 *  4. Pra top 10, pega videos recentes + calcula media
 *  5. Roda Google Trends (categoria) 1x
 *  6. Calcula score de oportunidade
 *  7. Salva tudo
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const categoria = (body.categoria || "").trim();
  const pais = body.pais || "BR";
  const min_inscritos = Math.max(1000, Number(body.min_inscritos) || 1000);
  const max_inscritos = Math.min(10000000, Number(body.max_inscritos) || 500000);
  const max_videos = Math.max(5, Number(body.max_videos) || 50);

  if (!categoria) return new NextResponse("categoria obrigatoria", { status: 400 });

  // 1. cria pesquisa
  const { data: pesquisa, error: pErr } = await supabase.from("youtube_pesquisas").insert({
    tenant_id: m.tenant_id,
    categoria, pais, max_inscritos, min_inscritos, max_videos,
    created_by: user.id,
  }).select().single();
  if (pErr) return new NextResponse(pErr.message, { status: 400 });

  // 2. busca canais
  let searchResults;
  try {
    searchResults = await searchChannels(categoria, pais, 50);
  } catch (e: unknown) {
    return new NextResponse(`YT Search: ${e instanceof Error ? e.message : "erro"}`, { status: 500 });
  }

  const channelIds = [...new Set(searchResults.map((r) => r.snippet?.channelId).filter(Boolean) as string[])];
  if (channelIds.length === 0) {
    return NextResponse.json({ pesquisa_id: pesquisa.id, canais: [], message: "Nenhum canal encontrado" });
  }

  // 3. stats
  const channels = await getChannels(channelIds);

  // helpers de pais/idioma por regiao
  const acceptedCountries: Record<string, string[]> = {
    BR: ["BR", "PT"],
    US: ["US", "CA", "GB", "AU", "IE", "NZ"],
    PT: ["PT", "BR"],
    MX: ["MX", "AR", "CO", "ES", "CL", "PE"],
    ES: ["ES", "MX", "AR", "CO"],
  };
  const acceptedLangPrefix: Record<string, string> = {
    BR: "pt", US: "en", PT: "pt", MX: "es", ES: "es",
  };
  const countries = acceptedCountries[pais] || [];
  const langPrefix = acceptedLangPrefix[pais] || "";

  // 4. filtra + enriquece
  const oportunidades = channels.filter((c) => {
    const sub = Number(c.statistics?.subscriberCount || 0);
    const vid = Number(c.statistics?.videoCount || 0);
    if (!(sub >= min_inscritos && sub <= max_inscritos && vid <= max_videos && vid >= 3)) return false;

    // filtro de pais/idioma real do canal
    const canalPais = c.snippet?.country || c.brandingSettings?.channel?.country;
    const canalLang = c.snippet?.defaultLanguage || c.brandingSettings?.channel?.defaultLanguage || "";

    // se canal tem pais setado, exige que bata com os aceitos da regiao
    if (canalPais && countries.length > 0 && !countries.includes(canalPais)) return false;

    // se canal tem idioma setado e nao bate com prefixo da regiao, rejeita
    if (canalLang && langPrefix && !canalLang.toLowerCase().startsWith(langPrefix)) return false;

    return true;
  }).slice(0, 30);  // limita processing

  // 5. pra top 15, pega videos recentes
  const topCanais = oportunidades.slice(0, 15);
  const mediaViewsByChannel = new Map<string, number>();

  await Promise.all(topCanais.map(async (c) => {
    try {
      const videos = await getRecentVideos(c.id, 10);
      if (videos.length > 0) {
        const totalViews = videos.reduce((sum, v) => sum + Number(v.statistics?.viewCount || 0), 0);
        mediaViewsByChannel.set(c.id, Math.round(totalViews / videos.length));
      }
    } catch {}
  }));

  // 6. Google Trends (1x pra categoria geral)
  const trendsData = await interestOverTime(categoria, pais);

  // 7. calcula score de oportunidade + salva
  const rows = oportunidades.map((c) => {
    const sub = Number(c.statistics?.subscriberCount || 0);
    const vid = Number(c.statistics?.videoCount || 0);
    const views = Number(c.statistics?.viewCount || 0);
    const mediaViews = mediaViewsByChannel.get(c.id) || 0;

    // score: canais com poucos videos + muitos inscritos + alta media views = ouro
    const eficiencia = vid > 0 ? views / vid : 0;                      // views por video historico
    const ctr = sub > 0 ? (mediaViews / sub) * 100 : 0;                // % de inscritos que assiste

    // score 0-100 (normalizado)
    const scoreVideosBaixos = Math.max(0, 100 - vid * 2);              // 0 videos = 100, 50 videos = 0
    const scoreCtr = Math.min(100, ctr * 2);                           // 50% CTR = 100
    const scoreEficiencia = Math.min(100, Math.log10(eficiencia + 1) * 15);
    const scoreTrends = trendsData.gap > 0 ? Math.min(100, trendsData.gap * 2) : 0;

    const score_oportunidade = Math.round(
      scoreVideosBaixos * 0.3 + scoreCtr * 0.3 + scoreEficiencia * 0.25 + scoreTrends * 0.15
    );

    return {
      tenant_id: m.tenant_id,
      pesquisa_id: pesquisa.id,
      channel_id: c.id,
      channel_name: c.snippet?.title || "Sem nome",
      channel_url: `https://www.youtube.com/channel/${c.id}`,
      inscritos: sub,
      total_videos: vid,
      total_views: views,
      data_criacao_canal: c.snippet?.publishedAt ? c.snippet.publishedAt.slice(0, 10) : null,
      idioma: c.snippet?.defaultLanguage || c.brandingSettings?.channel?.defaultLanguage || null,
      pais: c.snippet?.country || c.brandingSettings?.channel?.country || pais,
      thumbnail_url: c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || null,
      descricao: (c.snippet?.description || "").slice(0, 500),
      media_views_ultimos_30d: mediaViews,
      ctr_estimado: Number(ctr.toFixed(2)),
      score_oportunidade,
      trends_google_score: trendsData.google,
      trends_youtube_score: trendsData.youtube,
      trends_gap: trendsData.gap,
    };
  });

  if (rows.length > 0) {
    await supabase.from("youtube_canais_minerados").upsert(rows, {
      onConflict: "tenant_id,channel_id", ignoreDuplicates: false,
    });
  }

  await supabase.from("youtube_pesquisas").update({ total_encontrados: rows.length }).eq("id", pesquisa.id);

  return NextResponse.json({
    pesquisa_id: pesquisa.id,
    total: rows.length,
    trends: trendsData,
    canais: rows.sort((a, b) => b.score_oportunidade - a.score_oportunidade).slice(0, 30),
  });
}
