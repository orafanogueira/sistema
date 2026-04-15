/**
 * YouTube Data API v3 wrapper.
 * Docs: https://developers.google.com/youtube/v3/docs
 */

const BASE = "https://www.googleapis.com/youtube/v3";

function apiKey(): string {
  const k = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY ausente");
  return k;
}

interface YTSearchResult {
  kind: string;
  id: { kind: string; channelId?: string; videoId?: string };
  snippet: { channelId: string; title: string; description?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } }; channelTitle?: string };
}

/** Busca canais por termo (categoria). */
export async function searchChannels(query: string, regionCode = "BR", maxResults = 50): Promise<YTSearchResult[]> {
  const url = `${BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&regionCode=${regionCode}&maxResults=${Math.min(maxResults, 50)}&key=${apiKey()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`YT search ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.items || [];
}

interface YTChannel {
  id: string;
  snippet: { title: string; description?: string; publishedAt: string; country?: string; defaultLanguage?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } };
  statistics: { viewCount?: string; subscriberCount?: string; videoCount?: string };
  brandingSettings?: { channel?: { country?: string; defaultLanguage?: string } };
}

/** Pega detalhes completos de um ou varios canais por ID. */
export async function getChannels(channelIds: string[]): Promise<YTChannel[]> {
  if (channelIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < channelIds.length; i += 50) chunks.push(channelIds.slice(i, i + 50));

  const all: YTChannel[] = [];
  for (const chunk of chunks) {
    const url = `${BASE}/channels?part=snippet,statistics,brandingSettings&id=${chunk.join(",")}&key=${apiKey()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`YT channels ${r.status}`);
    const data = await r.json();
    all.push(...(data.items || []));
  }
  return all;
}

interface YTVideo {
  id: string;
  snippet: { channelId: string; publishedAt: string; title: string };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
}

/** Pega videos recentes de um canal (para calcular media de views). */
export async function getRecentVideos(channelId: string, maxResults = 10): Promise<YTVideo[]> {
  const searchUrl = `${BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey()}`;
  const r = await fetch(searchUrl);
  if (!r.ok) return [];
  const data = await r.json();
  const videoIds = (data.items || []).map((it: { id?: { videoId?: string } }) => it.id?.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const statsUrl = `${BASE}/videos?part=snippet,statistics&id=${videoIds.join(",")}&key=${apiKey()}`;
  const r2 = await fetch(statsUrl);
  if (!r2.ok) return [];
  const data2 = await r2.json();
  return data2.items || [];
}
