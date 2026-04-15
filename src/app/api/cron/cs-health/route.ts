import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Cron diario: calcula health score de cada cliente ativo.
 * Schedule: 0 5 * * * (5am diario)
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const { data: clientes } = await supabase
    .from("clientes").select("id,tenant_id,status,ticket_mensal,data_inicio").eq("status", "ativo");

  let processed = 0;

  for (const c of clientes || []) {
    // Score engagement: posts publicados ultimos 30d
    const { count: postsCount } = await supabase
      .from("social_posts").select("*", { count: "exact", head: true })
      .eq("cliente_id", c.id).eq("status", "publicado").gte("published_at", thirtyDaysAgo);
    const score_engagement = Math.min(25, (postsCount || 0) * 2);

    // Score performance: leads ultimos 30d
    const { count: leadsCount } = await supabase
      .from("leads").select("*", { count: "exact", head: true })
      .eq("cliente_id", c.id).gte("created_at", thirtyDaysAgo);
    const score_performance = Math.min(25, (leadsCount || 0));

    // Score payment: sem inadimplencia
    const { count: inadCount } = await supabase
      .from("cobrancas").select("*", { count: "exact", head: true })
      .eq("cliente_id", c.id).in("status", ["pendente", "vencida"]).lt("due_date", today);
    const is_inadimplente = (inadCount || 0) > 0;
    const score_payment = is_inadimplente ? 0 : 25;

    // Score comunicacao: tempo medio de resposta (leads com primeira_resposta)
    const { data: tempoResp } = await supabase.rpc("tempo_medio_resposta_min", { p_cliente_id: c.id, p_dias: 7 });
    const tempo = typeof tempoResp === "number" ? tempoResp : 60;
    const score_comunicacao = tempo <= 15 ? 15 : tempo <= 60 ? 10 : tempo <= 180 ? 5 : 0;

    // Score resultado: vendas (leads ganhos)
    const { count: vendasCount } = await supabase
      .from("leads").select("*", { count: "exact", head: true })
      .eq("cliente_id", c.id).eq("status", "ganho").gte("updated_at", thirtyDaysAgo);
    const score_resultado = Math.min(10, (vendasCount || 0) * 2);

    // Alertas criticos?
    const { count: alertsCritical } = await supabase
      .from("alerts").select("*", { count: "exact", head: true })
      .eq("cliente_id", c.id).eq("is_resolved", false).eq("severity", "critical");
    const has_critical_alerts = (alertsCritical || 0) > 0;

    let health_score = score_engagement + score_performance + score_payment + score_comunicacao + score_resultado;
    if (has_critical_alerts) health_score = Math.max(0, health_score - 15);
    health_score = Math.min(100, Math.max(0, health_score));

    const churn_risk = health_score >= 70 ? "low" : health_score >= 40 ? "medium" : "high";

    // Meses ativo
    const meses_ativo = c.data_inicio
      ? Math.floor((Date.now() - new Date(c.data_inicio).getTime()) / (30 * 86400000))
      : 0;

    // LTV estimado: ticket * meses ativos + 6 meses previstos
    const ltv_estimated = Number(c.ticket_mensal || 0) * (meses_ativo + 6);

    await supabase.from("cs_health_snapshots").upsert({
      tenant_id: c.tenant_id, cliente_id: c.id, date: today,
      health_score, churn_risk,
      score_engagement, score_performance, score_payment, score_comunicacao, score_resultado,
      has_critical_alerts, is_inadimplente, meses_ativo, ltv_estimated,
    }, { onConflict: "cliente_id,date" });

    // Cria alerta de churn se score baixo
    if (health_score < 40) {
      await supabase.from("alerts").insert({
        tenant_id: c.tenant_id, cliente_id: c.id,
        type: "queda_leads", severity: "critical",
        title: `Health score critico (${health_score}/100)`,
        message: `Cliente com risco de churn ALTO. Score: ${health_score}. Acao proativa necessaria.`,
      }).select().maybeSingle();
    }

    processed++;
  }

  return NextResponse.json({ processed });
}
