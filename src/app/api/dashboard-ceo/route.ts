import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Endpoint do Dashboard Executivo CEO.
 * Retorna em 1 chamada todos os dados consolidados:
 * - KPIs gerais da carteira
 * - Alertas
 * - Rankings
 * - Health score por cliente
 */
export async function GET() {
  const supabase = await createClient();

  const today = new Date();
  const since30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const since60 = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0, 10);

  const [
    { count: totalClientes },
    { count: clientesAtivos },
    { data: clientes },
    { data: metrics },
    { data: leads30 },
    { data: posts },
    { data: alerts },
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("id,nome,vertical,ticket_mensal,status,vencimento"),
    supabase.from("metrics_daily").select("cliente_id,date,spend,clicks,impressions,leads,conversions").gte("date", since60),
    supabase.from("leads").select("id,cliente_id,status,origem,created_at,primeira_resposta_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("social_posts").select("id,cliente_id,status,published_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("alerts").select("id,cliente_id,type,severity,title,message,created_at,is_read,is_resolved").eq("is_resolved", false).order("severity", { ascending: false }).order("created_at", { ascending: false }).limit(50),
  ]);

  // KPIs consolidados
  const m30 = (metrics || []).filter((m) => m.date >= since30);
  const m30Anterior = (metrics || []).filter((m) => m.date < since30 && m.date >= since60);

  const spend30 = m30.reduce((s, m) => s + Number(m.spend || 0), 0);
  const spend30ant = m30Anterior.reduce((s, m) => s + Number(m.spend || 0), 0);
  const leadsCount30 = m30.reduce((s, m) => s + Number(m.leads || 0), 0);
  const leadsCount30ant = m30Anterior.reduce((s, m) => s + Number(m.leads || 0), 0);
  const clicks30 = m30.reduce((s, m) => s + Number(m.clicks || 0), 0);
  const impressions30 = m30.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const conversoes30 = m30.reduce((s, m) => s + Number(m.conversions || 0), 0);

  // Honorario total (sum ticket_mensal)
  const honorarioMensal = (clientes || []).filter((c) => c.status === "ativo").reduce((s, c) => s + Number(c.ticket_mensal || 0), 0);

  // Por cliente - dados agregados
  const clienteData = (clientes || []).map((c) => {
    const cm = m30.filter((m) => m.cliente_id === c.id);
    const cmAnt = m30Anterior.filter((m) => m.cliente_id === c.id);
    const cl = (leads30 || []).filter((l) => l.cliente_id === c.id);
    const cp = (posts || []).filter((p) => p.cliente_id === c.id);
    const cAlerts = (alerts || []).filter((a) => a.cliente_id === c.id);

    const cliSpend = cm.reduce((s, m) => s + Number(m.spend || 0), 0);
    const cliSpendAnt = cmAnt.reduce((s, m) => s + Number(m.spend || 0), 0);
    const cliLeads = cm.reduce((s, m) => s + Number(m.leads || 0), 0);
    const cliLeadsAnt = cmAnt.reduce((s, m) => s + Number(m.leads || 0), 0);
    const cliClicks = cm.reduce((s, m) => s + Number(m.clicks || 0), 0);
    const cliImpressions = cm.reduce((s, m) => s + Number(m.impressions || 0), 0);

    const cpl = cliLeads > 0 ? cliSpend / cliLeads : 0;
    const cplAnt = cliLeadsAnt > 0 ? cliSpendAnt / cliLeadsAnt : 0;
    const ctr = cliImpressions > 0 ? (cliClicks / cliImpressions) * 100 : 0;
    const deltaLeads = cliLeadsAnt > 0 ? ((cliLeads - cliLeadsAnt) / cliLeadsAnt) * 100 : 0;
    const deltaCpl = cplAnt > 0 ? ((cpl - cplAnt) / cplAnt) * 100 : 0;

    const leadsGanhos = cl.filter((l) => l.status === "ganho").length;
    const roasEstimado = cliSpend > 0 ? (leadsGanhos * Number(c.ticket_mensal || 0)) / cliSpend : 0;

    const postsPublicados = cp.filter((p) => p.status === "publicado").length;
    const ultimaPostagem = cp.filter((p) => p.published_at).sort((a, b) => (b.published_at! > a.published_at! ? 1 : -1))[0]?.published_at;

    const healthScore = 100 - (cAlerts.filter((a) => a.severity === "critical").length * 15) - (cAlerts.filter((a) => a.severity === "warning").length * 8);

    return {
      ...c,
      spend_30d: cliSpend,
      leads_30d: cliLeads,
      ctr_30d: ctr,
      cpl_30d: cpl,
      delta_leads_pct: deltaLeads,
      delta_cpl_pct: deltaCpl,
      leads_ganhos: leadsGanhos,
      roas_estimado: roasEstimado,
      posts_publicados: postsPublicados,
      ultima_postagem: ultimaPostagem,
      alerts_count: cAlerts.length,
      health_score: Math.max(0, Math.min(100, healthScore)),
    };
  });

  // Rankings
  const rankRoas = [...clienteData].filter((c) => c.spend_30d > 0).sort((a, b) => b.roas_estimado - a.roas_estimado).slice(0, 5);
  const rankLeads = [...clienteData].sort((a, b) => b.leads_30d - a.leads_30d).slice(0, 5);
  const rankCtr = [...clienteData].filter((c) => c.spend_30d > 0).sort((a, b) => b.ctr_30d - a.ctr_30d).slice(0, 5);
  const rankCplPior = [...clienteData].filter((c) => c.cpl_30d > 0).sort((a, b) => b.cpl_30d - a.cpl_30d).slice(0, 5);
  const rankCrescimento = [...clienteData].filter((c) => c.delta_leads_pct > 0).sort((a, b) => b.delta_leads_pct - a.delta_leads_pct).slice(0, 5);

  // Distribuicao de leads por origem
  const leadsPorOrigem: Record<string, number> = {};
  for (const l of leads30 || []) {
    leadsPorOrigem[l.origem] = (leadsPorOrigem[l.origem] || 0) + 1;
  }

  return NextResponse.json({
    kpis: {
      clientes_total: totalClientes || 0,
      clientes_ativos: clientesAtivos || 0,
      honorario_mensal: honorarioMensal,
      mrr: honorarioMensal,
      verba_30d: spend30,
      verba_30d_anterior: spend30ant,
      leads_30d: leadsCount30,
      leads_30d_anterior: leadsCount30ant,
      clicks_30d: clicks30,
      impressions_30d: impressions30,
      conversoes_30d: conversoes30,
      cpl_medio: leadsCount30 > 0 ? spend30 / leadsCount30 : 0,
      ctr_medio: impressions30 > 0 ? (clicks30 / impressions30) * 100 : 0,
      cpc_medio: clicks30 > 0 ? spend30 / clicks30 : 0,
      delta_leads_pct: leadsCount30ant > 0 ? ((leadsCount30 - leadsCount30ant) / leadsCount30ant) * 100 : 0,
      delta_spend_pct: spend30ant > 0 ? ((spend30 - spend30ant) / spend30ant) * 100 : 0,
    },
    alerts: alerts || [],
    alerts_summary: {
      total: (alerts || []).length,
      critical: (alerts || []).filter((a) => a.severity === "critical").length,
      warning: (alerts || []).filter((a) => a.severity === "warning").length,
      info: (alerts || []).filter((a) => a.severity === "info").length,
    },
    rankings: {
      melhor_roas: rankRoas,
      mais_leads: rankLeads,
      melhor_ctr: rankCtr,
      pior_cpl: rankCplPior,
      maior_crescimento: rankCrescimento,
    },
    leads_por_origem: leadsPorOrigem,
    clientes: clienteData.sort((a, b) => a.health_score - b.health_score),
  });
}
