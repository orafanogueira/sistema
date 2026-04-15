/**
 * Gerador de relatorio mensal - produz HTML + texto WhatsApp.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MetaAdsClient, extractAction } from "@/lib/integrations/meta-ads";
import { aiChat } from "@/lib/integrations/ai";

export interface RelatorioConfig {
  include_social: boolean;
  include_trafego: boolean;
  include_crm: boolean;
  include_financeiro: boolean;
}

export interface RelatorioMensal {
  html: string;
  whatsapp_text: string;
  data: Record<string, unknown>;
}

export async function gerarRelatorioMensal(opts: {
  supabase: SupabaseClient;
  cliente_id: string;
  mes: string;   // '2026-04'
  config: RelatorioConfig;
}): Promise<RelatorioMensal> {
  const { supabase, cliente_id, mes, config } = opts;

  const [ano, mesNum] = mes.split("-").map(Number);
  const inicio = new Date(ano, mesNum - 1, 1).toISOString().slice(0, 10);
  const fim = new Date(ano, mesNum, 0).toISOString().slice(0, 10);

  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", cliente_id).maybeSingle();
  if (!cliente) throw new Error("cliente nao encontrado");

  const data: Record<string, unknown> = { cliente_nome: cliente.nome, periodo: mes, inicio, fim };

  // Trafego pago
  if (config.include_trafego) {
    const { data: metrics } = await supabase.from("metrics_daily")
      .select("spend,clicks,impressions,leads").eq("cliente_id", cliente_id)
      .gte("date", inicio).lte("date", fim);
    const spend = (metrics || []).reduce((s, m) => s + Number(m.spend || 0), 0);
    const clicks = (metrics || []).reduce((s, m) => s + Number(m.clicks || 0), 0);
    const impressions = (metrics || []).reduce((s, m) => s + Number(m.impressions || 0), 0);
    const leads = (metrics || []).reduce((s, m) => s + Number(m.leads || 0), 0);
    data.trafego = {
      spend, clicks, impressions, leads,
      cpl: leads > 0 ? spend / leads : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
    };
  }

  // CRM
  if (config.include_crm) {
    const { data: leads } = await supabase.from("leads")
      .select("id,status,origem").eq("cliente_id", cliente_id)
      .gte("created_at", inicio).lte("created_at", fim);
    const total = leads?.length || 0;
    const ganhos = (leads || []).filter((l) => l.status === "ganho").length;
    data.crm = {
      total_leads: total, ganhos,
      taxa_conversao: total > 0 ? (ganhos / total) * 100 : 0,
      por_origem: (leads || []).reduce((acc, l) => { acc[l.origem] = (acc[l.origem] || 0) + 1; return acc; }, {} as Record<string, number>),
    };
  }

  // Social
  if (config.include_social) {
    const { data: posts } = await supabase.from("social_posts")
      .select("id,format,published_at").eq("cliente_id", cliente_id).eq("status", "publicado")
      .gte("published_at", inicio).lte("published_at", fim);
    data.social = { total_posts: posts?.length || 0 };
  }

  // Analise IA
  let analise = "";
  try {
    analise = await aiChat({
      systemPrompt: "Voce e gestor senior de agencia. Analise os dados e gere relatorio profissional em portugues, tom direto e humano. Nao use jargao desnecessario. Destaque o que performou bem, o que precisa atencao, e 2-3 acoes proximas.",
      messages: [{ role: "user", content: `Cliente: ${cliente.nome}\nPeriodo: ${mes}\nDados: ${JSON.stringify(data, null, 2)}\n\nEscreva relatorio em 3 blocos:\n1. Resumo (3-4 linhas)\n2. O que funcionou bem\n3. Proximos passos` }],
      temperature: 0.4, maxTokens: 1500,
    });
  } catch { analise = "Resumo: periodo operado normalmente."; }

  data.analise_ia = analise;

  const html = renderHTML(cliente, mes, data);
  const whatsapp_text = renderWhatsApp(cliente, mes, data);

  return { html, whatsapp_text, data };
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
function formatInt(v: number): string { return new Intl.NumberFormat("pt-BR").format(Math.round(v || 0)); }

function renderHTML(cliente: { nome: string }, mes: string, d: Record<string, unknown>): string {
  const t = d.trafego as { spend: number; clicks: number; leads: number; cpl: number; ctr: number } | undefined;
  const crm = d.crm as { total_leads: number; ganhos: number; taxa_conversao: number } | undefined;
  const social = d.social as { total_posts: number } | undefined;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatorio ${cliente.nome}</title>
<style>
body{font-family:Arial,sans-serif;background:#0d1117;color:#e2e8f0;margin:0;padding:40px;max-width:800px;margin:0 auto}
h1{font-size:24px;margin:0 0 8px}h2{font-size:16px;margin:32px 0 12px;color:#00c8e0;border-bottom:1px solid #1e2d3d;padding-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
.card{background:#111827;border:1px solid #1e2d3d;border-radius:10px;padding:16px}
.label{font-size:10px;color:#64748b;text-transform:uppercase}.value{font-size:22px;font-weight:800;margin-top:4px;color:#fff}
.analise{background:#111827;border-left:3px solid #00c8e0;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6}
</style></head><body>
<h1>${cliente.nome}</h1><div>Relatorio ${mes}</div>
${t ? `<h2>Trafego pago</h2><div class="grid">
<div class="card"><div class="label">Investido</div><div class="value">${formatBRL(t.spend)}</div></div>
<div class="card"><div class="label">Leads</div><div class="value">${formatInt(t.leads)}</div></div>
<div class="card"><div class="label">CPL</div><div class="value">${formatBRL(t.cpl)}</div></div>
<div class="card"><div class="label">Cliques</div><div class="value">${formatInt(t.clicks)}</div></div>
<div class="card"><div class="label">CTR</div><div class="value">${t.ctr.toFixed(2)}%</div></div>
</div>` : ""}
${crm ? `<h2>Comercial</h2><div class="grid">
<div class="card"><div class="label">Total leads</div><div class="value">${crm.total_leads}</div></div>
<div class="card"><div class="label">Vendas</div><div class="value">${crm.ganhos}</div></div>
<div class="card"><div class="label">Conversao</div><div class="value">${crm.taxa_conversao.toFixed(1)}%</div></div>
</div>` : ""}
${social ? `<h2>Social Media</h2><div class="card"><div class="label">Posts publicados</div><div class="value">${social.total_posts}</div></div>` : ""}
<h2>Analise</h2><div class="analise">${d.analise_ia}</div>
</body></html>`;
}

function renderWhatsApp(cliente: { nome: string }, mes: string, d: Record<string, unknown>): string {
  const t = d.trafego as { spend: number; leads: number; cpl: number } | undefined;
  const crm = d.crm as { total_leads: number; ganhos: number } | undefined;
  return `📊 *Relatorio ${mes} - ${cliente.nome}*

${t ? `💰 *Trafego*
- Investido: ${formatBRL(t.spend)}
- Leads: ${formatInt(t.leads)}
- CPL: ${formatBRL(t.cpl)}

` : ""}${crm ? `🎯 *Comercial*
- Leads totais: ${crm.total_leads}
- Vendas: ${crm.ganhos}

` : ""}📝 *Analise*
${d.analise_ia}

_Enviado pelo Grupo Nogueira OS_`;
}
