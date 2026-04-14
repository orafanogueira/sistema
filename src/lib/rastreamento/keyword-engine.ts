/**
 * Keyword engine - recebe uma mensagem e decide se o lead deve
 * avancar pra outra etapa da jornada baseado em palavras-chave.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractValueBRL } from "./value-extractor";

export interface KeywordMatchInput {
  supabase: SupabaseClient;
  lead_id: string;
  cliente_id: string;
  content: string;
  direction: "in" | "out";
}

export interface KeywordMatchResult {
  matched_keywords: string[];
  moved_to_etapa_id: string | null;
  moved_to_etapa_name: string | null;
  value_extracted: number | null;
  is_sale: boolean;
}

export async function processMessage(input: KeywordMatchInput): Promise<KeywordMatchResult> {
  const { supabase, lead_id, cliente_id, content, direction } = input;

  // 1. Busca lead + jornada atual
  const { data: lead } = await supabase
    .from("leads")
    .select("id, jornada_id, jornada_etapa_id")
    .eq("id", lead_id).maybeSingle();
  if (!lead) return empty();

  let jornada_id = lead.jornada_id;
  if (!jornada_id) {
    // pega jornada default do cliente
    const { data: jd } = await supabase
      .from("jornadas").select("id").eq("cliente_id", cliente_id).eq("is_default", true)
      .maybeSingle();
    jornada_id = jd?.id;
    if (!jornada_id) return empty();
    await supabase.from("leads").update({ jornada_id }).eq("id", lead_id);
  }

  // 2. Busca todas etapas + keywords
  const { data: etapas } = await supabase
    .from("jornada_etapas")
    .select("id, name, position, is_sale, keywords:jornada_keywords(pattern, is_regex, case_sensitive, direction)")
    .eq("jornada_id", jornada_id)
    .order("position", { ascending: true });

  if (!etapas?.length) return empty();

  const matched: string[] = [];
  let targetEtapa: { id: string; name: string; is_sale: boolean } | null = null;

  for (const etapa of etapas) {
    const keywords = (etapa.keywords as { pattern: string; is_regex: boolean; case_sensitive: boolean; direction: string }[]) || [];
    for (const kw of keywords) {
      if (kw.direction !== "any" && kw.direction !== direction) continue;
      if (matchKeyword(content, kw)) {
        matched.push(kw.pattern);
        // pega a etapa MAIS AVANCADA que matchou
        if (!targetEtapa || etapa.position > (etapas.find((e) => e.id === targetEtapa!.id)?.position || 0)) {
          targetEtapa = { id: etapa.id, name: etapa.name, is_sale: etapa.is_sale };
        }
      }
    }
  }

  // 3. Extrai valor se for etapa de venda
  let valueExtracted: number | null = null;
  if (targetEtapa?.is_sale) {
    valueExtracted = extractValueBRL(content);
  }

  // 4. Atualiza lead se houve match
  if (targetEtapa) {
    const update: Record<string, unknown> = {
      jornada_etapa_id: targetEtapa.id,
      ultima_atividade_at: new Date().toISOString(),
    };
    if (targetEtapa.is_sale) {
      update.status = "ganho";
      update.data_fechamento = new Date().toISOString().slice(0, 10);
      if (valueExtracted) {
        update.valor_venda = valueExtracted;
        update.valor_estimado = valueExtracted;
        update.data_venda_detectada = new Date().toISOString();
      }
    }
    await supabase.from("leads").update(update).eq("id", lead_id);
  }

  return {
    matched_keywords: matched,
    moved_to_etapa_id: targetEtapa?.id || null,
    moved_to_etapa_name: targetEtapa?.name || null,
    value_extracted: valueExtracted,
    is_sale: targetEtapa?.is_sale || false,
  };
}

function matchKeyword(
  content: string,
  kw: { pattern: string; is_regex: boolean; case_sensitive: boolean }
): boolean {
  try {
    if (kw.is_regex) {
      const flags = kw.case_sensitive ? "" : "i";
      return new RegExp(kw.pattern, flags).test(content);
    }
    const haystack = kw.case_sensitive ? content : content.toLowerCase();
    const needle = kw.case_sensitive ? kw.pattern : kw.pattern.toLowerCase();
    return haystack.includes(needle);
  } catch {
    return false;
  }
}

function empty(): KeywordMatchResult {
  return { matched_keywords: [], moved_to_etapa_id: null, moved_to_etapa_name: null, value_extracted: null, is_sale: false };
}
