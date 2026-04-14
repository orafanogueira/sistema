import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard Tintim-like - retorna dados consolidados de rastreamento.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  const days = Number(url.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const qBase = (table: string) => {
    let q = supabase.from(table).select("*").gte("created_at", since);
    if (cliente_id) q = q.eq("cliente_id", cliente_id);
    return q;
  };

  const [{ data: leads }, { data: clicks }, { data: pviews }, { data: pixelEvents }] = await Promise.all([
    qBase("leads"),
    qBase("link_clicks"),
    qBase("page_views"),
    qBase("pixel_events"),
  ]);

  const totalLeads = leads?.length || 0;
  const leadsRastreados = (leads || []).filter((l) => l.fbclid || l.gclid || l.origem !== "outro").length;
  const leadsGanhos = (leads || []).filter((l) => l.status === "ganho");
  const faturamento = leadsGanhos.reduce((s, l) => s + Number(l.valor_venda || l.valor_estimado || 0), 0);
  const taxaConversao = totalLeads > 0 ? (leadsGanhos.length / totalLeads) * 100 : 0;

  // Origem dos leads
  const porOrigem: Record<string, number> = {};
  for (const l of leads || []) {
    porOrigem[l.origem] = (porOrigem[l.origem] || 0) + 1;
  }

  // Dia a dia
  const porDia: Record<string, number> = {};
  for (const l of leads || []) {
    const dia = l.created_at.slice(0, 10);
    porDia[dia] = (porDia[dia] || 0) + 1;
  }
  const conversasPorDia = Object.entries(porDia)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top campanhas
  const porCampanha: Record<string, number> = {};
  for (const l of leads || []) {
    const c = l.campaign_name || l.origem_detalhe || "(sem campanha)";
    porCampanha[c] = (porCampanha[c] || 0) + 1;
  }
  const topCampanhas = Object.entries(porCampanha)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  // Eventos de pixel
  const pixelSent = (pixelEvents || []).filter((e) => e.status === "sent").length;
  const pixelFailed = (pixelEvents || []).filter((e) => e.status === "failed").length;
  const pixelPending = (pixelEvents || []).filter((e) => e.status === "pending").length;

  // Page views (tracking ANTES do WhatsApp)
  const sessionsUnicas = new Set((pviews || []).map((v) => v.session_id)).size;

  return NextResponse.json({
    periodo_dias: days,
    totals: {
      conversas_ativas: totalLeads,
      rastreadas: leadsRastreados,
      taxa_rastreio: totalLeads > 0 ? (leadsRastreados / totalLeads) * 100 : 0,
      vendas: leadsGanhos.length,
      faturamento,
      taxa_conversao: taxaConversao,
      cliques_em_links: clicks?.length || 0,
      sessions_unicas_site: sessionsUnicas,
    },
    por_origem: porOrigem,
    conversas_por_dia: conversasPorDia,
    top_campanhas: topCampanhas,
    pixel: {
      enviados: pixelSent,
      falhados: pixelFailed,
      pendentes: pixelPending,
    },
  });
}
