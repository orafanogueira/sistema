/**
 * Google Trends via biblioteca nao-oficial (google-trends-api).
 * Retorna comparativo: interesse no Google (web) vs YouTube.
 * Gap grande = nicho com muita busca no Google mas pouca oferta no YouTube = oportunidade.
 */

// dynamic import pra nao quebrar build se pacote faltar
export async function interestOverTime(keyword: string, geo = "BR"): Promise<{ google: number; youtube: number; gap: number }> {
  try {
    const googleTrends = (await import("google-trends-api")).default as {
      interestOverTime: (opts: { keyword: string; geo?: string; property?: string; startTime?: Date }) => Promise<string>;
    };

    const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);  // ultimos 90 dias

    const [webRaw, ytRaw] = await Promise.all([
      googleTrends.interestOverTime({ keyword, geo, startTime }),
      googleTrends.interestOverTime({ keyword, geo, property: "youtube", startTime }),
    ]);

    const avgInterest = (raw: string): number => {
      try {
        const parsed = JSON.parse(raw) as { default?: { timelineData?: Array<{ value: number[] }> } };
        const points = parsed.default?.timelineData || [];
        if (points.length === 0) return 0;
        const sum = points.reduce((acc, p) => acc + (p.value?.[0] || 0), 0);
        return Math.round(sum / points.length);
      } catch { return 0; }
    };

    const google = avgInterest(webRaw);
    const youtube = avgInterest(ytRaw);
    return { google, youtube, gap: google - youtube };
  } catch (e) {
    // falha silenciosa — retorna zeros e loga
    console.error("[trends]", e instanceof Error ? e.message : e);
    return { google: 0, youtube: 0, gap: 0 };
  }
}
