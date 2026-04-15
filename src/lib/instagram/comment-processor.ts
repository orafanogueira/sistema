/**
 * Processador de comentarios no Instagram.
 * Recebe um comentario novo (via webhook Meta), bate com as keywords
 * das automacoes ativas do cliente e dispara DM automatica.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { igPrivateReplyToComment, igReplyToCommentPublic, igGetUserInfo } from "./graph-api";

export interface ProcessCommentInput {
  supabase: SupabaseClient;
  cliente_id: string;
  ig_account_id: string;       // instagram_accounts.id (interno)
  page_access_token: string;
  ig_user_business_id: string; // IG Business Account ID (externo)

  comment_id: string;
  post_id: string;
  author_igsid: string;
  author_username?: string;
  comment_text: string;
}

export interface ProcessResult {
  ran_automations: number;
  sent_dms: number;
  sent_public_replies: number;
  errors: string[];
}

export async function processIgComment(input: ProcessCommentInput): Promise<ProcessResult> {
  const { supabase, cliente_id, ig_account_id, page_access_token, ig_user_business_id,
          comment_id, post_id, author_igsid, comment_text } = input;

  const result: ProcessResult = { ran_automations: 0, sent_dms: 0, sent_public_replies: 0, errors: [] };

  // 1. Log raw
  await supabase.from("ig_comments_raw").upsert({
    comment_id,
    cliente_id, ig_account_id, post_id,
    user_id: author_igsid,
    username: input.author_username,
    text: comment_text,
  }, { onConflict: "comment_id" });

  // 2. Busca automacoes ativas pro cliente
  const { data: automacoes } = await supabase
    .from("ig_automacoes")
    .select("*")
    .eq("cliente_id", cliente_id)
    .eq("ig_account_id", ig_account_id)
    .eq("is_active", true)
    .eq("trigger", "comment_on_post");

  if (!automacoes?.length) return result;

  // tenta pegar username se nao veio
  let authorUsername = input.author_username;
  if (!authorUsername) {
    try { const info = await igGetUserInfo(author_igsid, page_access_token); authorUsername = info.username; }
    catch { /* ignora */ }
  }

  for (const a of automacoes) {
    // Filtro de post especifico
    if (a.post_ids?.length) {
      const { data: posts } = await supabase.from("ig_posts_monitorados")
        .select("ig_media_id").in("id", a.post_ids);
      const matched_posts = (posts || []).map((p) => p.ig_media_id);
      if (!matched_posts.includes(post_id)) continue;
    }

    // Match de keywords
    const kw = (a.keywords as string[]) || [];
    if (!kw.length) continue;
    const matched = matchKeywords(comment_text, kw, a.keyword_match_mode, a.case_sensitive);
    if (!matched) continue;

    // one_per_user check
    if (a.one_per_user) {
      const { data: prev } = await supabase.from("ig_automacao_runs")
        .select("id").eq("automacao_id", a.id).eq("ig_user_id", author_igsid)
        .limit(1).maybeSingle();
      if (prev) {
        await supabase.from("ig_automacao_runs").insert({
          automacao_id: a.id, cliente_id, ig_user_id: author_igsid, ig_username: authorUsername,
          comment_id, comment_text, post_id,
          action_taken: "ignored", status: "skipped",
          error: "usuario ja recebeu (one_per_user)",
        });
        continue;
      }
    }

    result.ran_automations++;
    const response = renderResponse(a.response_text || "Oi! Vou te mandar no direct 📩", { nome: authorUsername || "amigo" });

    // Send DM (Private Reply)
    let dmError: string | null = null;
    try {
      await igPrivateReplyToComment({
        ig_user_id: ig_user_business_id,
        comment_id,
        message: response,
        page_access_token,
      });
      result.sent_dms++;
    } catch (e: unknown) {
      dmError = e instanceof Error ? e.message : "erro";
      result.errors.push(dmError);
    }

    // Public reply opcional
    if (a.send_public_reply && a.public_reply_text) {
      try {
        await igReplyToCommentPublic({
          comment_id, message: a.public_reply_text, page_access_token,
        });
        result.sent_public_replies++;
      } catch (e: unknown) {
        result.errors.push(e instanceof Error ? e.message : "erro public reply");
      }
    }

    // Cria lead se configurado
    let lead_id: string | null = null;
    if (a.create_lead) {
      const { data: tenant } = await supabase.from("ig_automacoes").select("tenant_id").eq("id", a.id).maybeSingle();
      if (tenant) {
        const { data: lead } = await supabase.from("leads").insert({
          tenant_id: tenant.tenant_id, cliente_id,
          nome: authorUsername || "Lead Instagram",
          origem: "meta_ads_instagram",
          origem_detalhe: `Comentario IG · post ${post_id}`,
          status: "novo",
          ig_automacao_id: a.id,
          ig_post_id: post_id,
          ig_username: authorUsername,
          tags: a.tags || [],
        }).select("id").single();
        lead_id = lead?.id || null;
      }
    }

    // Log run
    await supabase.from("ig_automacao_runs").insert({
      automacao_id: a.id, cliente_id, lead_id,
      ig_user_id: author_igsid, ig_username: authorUsername,
      comment_id, comment_text, post_id,
      matched_keyword: matched,
      action_taken: dmError ? "failed" : "sent_dm",
      response_sent: dmError ? null : response,
      status: dmError ? "failed" : "success",
      error: dmError,
    });

    await supabase.from("ig_automacoes").update({
      runs_count: (a.runs_count || 0) + 1,
      last_run_at: new Date().toISOString(),
    }).eq("id", a.id);
  }

  return result;
}

function matchKeywords(text: string, keywords: string[], mode: string, caseSensitive: boolean): string | null {
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needles = caseSensitive ? keywords : keywords.map((k) => k.toLowerCase());

  if (mode === "exact") {
    for (let i = 0; i < needles.length; i++) {
      if (haystack.trim() === needles[i]) return keywords[i];
    }
    return null;
  }
  if (mode === "all") {
    const allMatch = needles.every((k) => haystack.includes(k));
    return allMatch ? needles.join(" + ") : null;
  }
  // any (default)
  for (let i = 0; i < needles.length; i++) {
    if (haystack.includes(needles[i])) return keywords[i];
  }
  return null;
}

function renderResponse(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || "");
}
