/**
 * SEO Keyword Research helpers.
 * Stub pra integrar com Google Keyword Planner, SEMrush, Google Trends.
 *
 * Por enquanto fornece UI/UX pra cadastro manual + analise via IA.
 * Integracao real com essas APIs requer OAuth + plano pago em cada.
 */

export interface KeywordData {
  keyword: string;
  search_volume?: number;
  difficulty?: number;
  intent?: "transactional" | "informational" | "navigational" | "commercial";
  funnel_stage?: "topo" | "meio" | "fundo";
  cpc_avg?: number;
  trend?: "rising" | "stable" | "falling";
}

/**
 * Quando tiver Google Ads API Standard aprovado, usar Keyword Planner:
 * https://developers.google.com/google-ads/api/docs/keyword-planning/overview
 */
export async function researchKeywordsGoogle(seed: string, region = "BR"): Promise<KeywordData[]> {
  // Stub - substituir por chamada real quando APIs estiverem ativas
  return [{ keyword: seed, search_volume: undefined, difficulty: undefined, intent: "commercial", funnel_stage: "meio" }];
}

/**
 * Stub pra Google Trends.
 * Nao tem API oficial gratuita; pyTrends ou RapidAPI pagos.
 */
export async function getTrendsData(keyword: string, region = "BR") {
  return { keyword, region, trend: "stable" as const, interest_over_time: [] };
}

/**
 * Analise de intencao via IA (funciona sem API externa).
 */
export function classifyIntent(keyword: string): KeywordData["intent"] {
  const lower = keyword.toLowerCase();
  if (/\b(comprar|preco|barato|melhor|onde|oferta|promo)\b/.test(lower)) return "transactional";
  if (/\b(como|porque|o que|guia|tutorial|dicas)\b/.test(lower)) return "informational";
  if (/\b(login|entrar|site|oficial|empresa)\b/.test(lower)) return "navigational";
  return "commercial";
}

export function classifyFunnel(keyword: string): KeywordData["funnel_stage"] {
  const lower = keyword.toLowerCase();
  if (/\b(como|o que|porque|dicas|aprender|guia)\b/.test(lower)) return "topo";
  if (/\b(melhor|vs|comparar|review|qual)\b/.test(lower)) return "meio";
  return "fundo";
}
