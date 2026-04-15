/**
 * Validador de oferta - calcula score de viabilidade baseado em multiplos sinais.
 * Usado no pipeline Maxxima pra decidir se vale produzir o info-produto.
 */

export interface ValidacaoInput {
  anuncios_ativos_dias?: number;       // do concorrente, via Meta Library
  concorrentes_count?: number;
  google_trends_score?: number;         // 0-100 via Trends
  volume_busca?: number;
  preco?: number;
  nicho?: string;
}

export interface ValidacaoResult {
  score: number;                        // 0-100
  veredito: "validar" | "revalidar" | "descartar";
  sinais_positivos: string[];
  sinais_negativos: string[];
  acoes_sugeridas: string[];
}

export function validarOferta(input: ValidacaoInput): ValidacaoResult {
  let score = 50;
  const pos: string[] = [];
  const neg: string[] = [];
  const acoes: string[] = [];

  // Anuncios ativos ha muito tempo = validado
  if (input.anuncios_ativos_dias !== undefined) {
    if (input.anuncios_ativos_dias >= 14) {
      score += 20; pos.push(`Concorrente roda anuncio ha ${input.anuncios_ativos_dias} dias (validado)`);
    } else if (input.anuncios_ativos_dias >= 7) {
      score += 10; pos.push(`Anuncio ativo ha ${input.anuncios_ativos_dias} dias (potencial)`);
    } else {
      score -= 10; neg.push(`Anuncio muito recente (${input.anuncios_ativos_dias} dias) - pode nao estar validado`);
      acoes.push("Aguardar mais 7 dias e revalidar");
    }
  }

  // Google Trends
  if (input.google_trends_score !== undefined) {
    if (input.google_trends_score >= 60) {
      score += 15; pos.push(`Google Trends alto (${input.google_trends_score}/100)`);
    } else if (input.google_trends_score >= 30) {
      score += 5;
    } else {
      score -= 5; neg.push(`Google Trends baixo (${input.google_trends_score}/100)`);
    }
  }

  // Volume de busca
  if (input.volume_busca !== undefined) {
    if (input.volume_busca >= 10000) {
      score += 15; pos.push(`Alto volume de busca (${input.volume_busca.toLocaleString("pt-BR")}/mes)`);
    } else if (input.volume_busca >= 1000) {
      score += 5;
    } else {
      score -= 10; neg.push(`Baixo volume de busca`);
    }
  }

  // Concorrencia
  if (input.concorrentes_count !== undefined) {
    if (input.concorrentes_count >= 3 && input.concorrentes_count <= 8) {
      score += 10; pos.push(`Nicho com ${input.concorrentes_count} concorrentes (mercado aquecido mas com espaco)`);
    } else if (input.concorrentes_count > 8) {
      score -= 5; neg.push(`${input.concorrentes_count} concorrentes - mercado saturado`);
    } else if (input.concorrentes_count < 3) {
      score -= 5; neg.push(`Pouca concorrencia (${input.concorrentes_count}) - possivel falta de demanda`);
    }
  }

  // Preco (sweet spot 47-197 pra low ticket BR)
  if (input.preco !== undefined) {
    if (input.preco >= 47 && input.preco <= 197) {
      score += 5; pos.push(`Preco no sweet spot de low ticket (R$ ${input.preco})`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  const veredito: ValidacaoResult["veredito"] = score >= 70 ? "validar" : score >= 50 ? "revalidar" : "descartar";

  if (veredito === "validar") acoes.push("Iniciar producao: ebook + criativos + campanha teste");
  if (veredito === "revalidar") acoes.push("Reunir mais dados: mais concorrentes, Trends, volume de busca");
  if (veredito === "descartar") acoes.push("Procurar outra oferta - sinais nao justificam investimento");

  return { score, veredito, sinais_positivos: pos, sinais_negativos: neg, acoes_sugeridas: acoes };
}
