/**
 * Extrai valor monetario de uma mensagem em PT-BR.
 *  "no valor de R$ 500"         -> 500
 *  "R$ 1.200,00"                -> 1200
 *  "2,5k"                       -> 2500
 *  "parabens por adquirir..."   -> null se nao tiver valor
 */
export function extractValueBRL(text: string): number | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ");

  // Match 1: "R$ X" ou "R$X" com formato BR
  const re1 = /R\$\s?([\d.]+(?:,\d+)?)/gi;
  let best: number | null = null;
  for (const m of t.matchAll(re1)) {
    const raw = m[1].replace(/\./g, "").replace(",", ".");
    const v = parseFloat(raw);
    if (!isNaN(v) && (best === null || v > best)) best = v;
  }
  if (best !== null) return best;

  // Match 2: "2,5k" / "500,00" seguido de "reais"
  const re2 = /([\d.]+(?:,\d+)?)\s?(?:reais?|real)\b/gi;
  for (const m of t.matchAll(re2)) {
    const raw = m[1].replace(/\./g, "").replace(",", ".");
    const v = parseFloat(raw);
    if (!isNaN(v) && (best === null || v > best)) best = v;
  }

  return best;
}

/** Extrai telefone/whatsapp simples de uma mensagem. */
export function extractPhone(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(\+?55\s?)?\(?(\d{2})\)?\s?9?\s?\d{4}[-\s]?\d{4}/);
  if (!m) return null;
  return m[0].replace(/\D/g, "");
}
