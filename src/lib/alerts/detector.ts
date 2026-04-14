/**
 * Detector de alertas - roda no cron e cria alertas em tabela `alerts`.
 * Cada regra le metricas + condicao + cria alerta com severity.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AlertInput {
  tenant_id: string;
  cliente_id?: string;
  type: string;
  severity?: "info" | "warning" | "critical";
  title: string;
  message?: string;
  metric_name?: string;
  current_value?: number;
  expected_value?: number;
  delta_pct?: number;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
}

async function createAlert(supabase: SupabaseClient, alert: AlertInput) {
  // evita duplicar mesmo alerta nao-resolvido nas ultimas 12h
  const { data: existing } = await supabase
    .from("alerts").select("id")
    .eq("tenant_id", alert.tenant_id)
    .eq("cliente_id", alert.cliente_id || "")
    .eq("type", alert.type)
    .eq("is_resolved", false)
    .gte("created_at", new Date(Date.now() - 12 * 3600000).toISOString())
    .maybeSingle();
  if (existing) return null;

  const { data } = await supabase.from("alerts").insert({
    ...alert, severity: alert.severity || "warning",
  }).select().single();
  return data;
}

// ============================================================
// Detectores individuais
// ============================================================

export async function detectarQuedaLeads(supabase: SupabaseClient, tenant_id: string) {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const twoWeeks = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  const { data: clientes } = await supabase.from("clientes").select("id,nome").eq("tenant_id", tenant_id).eq("status", "ativo");

  for (const c of clientes || []) {
    const { data: m } = await supabase
      .from("metrics_daily").select("date,leads")
      .eq("cliente_id", c.id).gte("date", twoWeeks);
    if (!m?.length) continue;

    const leadsRecente = m.filter((x) => x.date >= weekAgo).reduce((s, x) => s + (x.leads || 0), 0);
    const leadsAnterior = m.filter((x) => x.date < weekAgo).reduce((s, x) => s + (x.leads || 0), 0);
    if (leadsAnterior < 5) continue; // base muito pequena

    const delta = ((leadsRecente - leadsAnterior) / leadsAnterior) * 100;
    if (delta < -30) {
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "queda_leads", severity: delta < -50 ? "critical" : "warning",
        title: `${c.nome}: leads cairam ${Math.abs(delta).toFixed(0)}% essa semana`,
        message: `${leadsRecente} leads nos ultimos 7d vs ${leadsAnterior} na semana anterior. Investigar criativos, verba e funil.`,
        metric_name: "leads", current_value: leadsRecente, expected_value: leadsAnterior, delta_pct: delta,
      });
    }
  }
}

export async function detectarAumentoCPL(supabase: SupabaseClient, tenant_id: string) {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const twoWeeks = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  const { data: clientes } = await supabase.from("clientes").select("id,nome").eq("tenant_id", tenant_id).eq("status", "ativo");

  for (const c of clientes || []) {
    const { data: m } = await supabase.from("metrics_daily")
      .select("date,leads,spend").eq("cliente_id", c.id).gte("date", twoWeeks);
    if (!m?.length) continue;

    const recRows = m.filter((x) => x.date >= weekAgo);
    const antRows = m.filter((x) => x.date < weekAgo);

    const cplRec = computeCPL(recRows);
    const cplAnt = computeCPL(antRows);
    if (!cplRec || !cplAnt) continue;

    const delta = ((cplRec - cplAnt) / cplAnt) * 100;
    if (delta > 35) {
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "aumento_cpl", severity: delta > 60 ? "critical" : "warning",
        title: `${c.nome}: CPL subiu ${delta.toFixed(0)}%`,
        message: `CPL atual R$ ${cplRec.toFixed(2)} vs R$ ${cplAnt.toFixed(2)} na semana anterior. Verificar fadiga criativa e segmentacao.`,
        metric_name: "cpl", current_value: cplRec, expected_value: cplAnt, delta_pct: delta,
      });
    }
  }
}

function computeCPL(rows: { leads: number; spend: number }[]): number {
  const leads = rows.reduce((s, r) => s + (r.leads || 0), 0);
  const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
  return leads > 0 ? spend / leads : 0;
}

export async function detectarSemPostagem(supabase: SupabaseClient, tenant_id: string, dias = 4) {
  const cutoff = new Date(Date.now() - dias * 86400000).toISOString();
  const { data: clientes } = await supabase.from("clientes").select("id,nome").eq("tenant_id", tenant_id).eq("status", "ativo");
  for (const c of clientes || []) {
    const { data: lastPost } = await supabase
      .from("social_posts").select("published_at")
      .eq("cliente_id", c.id).eq("status", "publicado")
      .order("published_at", { ascending: false }).limit(1).maybeSingle();
    if (lastPost && lastPost.published_at && lastPost.published_at < cutoff) {
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "sem_postagem", severity: "warning",
        title: `${c.nome}: sem post ha ${dias}+ dias`,
        message: `Ultimo post publicado: ${new Date(lastPost.published_at).toLocaleDateString("pt-BR")}.`,
      });
    } else if (!lastPost) {
      // nunca postou
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "sem_postagem", severity: "info",
        title: `${c.nome}: nenhum post registrado ainda`,
        message: "Ative o calendario editorial pra esse cliente.",
      });
    }
  }
}

export async function detectarTempoRespostaAlto(supabase: SupabaseClient, tenant_id: string) {
  const { data: clientes } = await supabase.from("clientes").select("id,nome").eq("tenant_id", tenant_id).eq("status", "ativo");
  for (const c of clientes || []) {
    const { data: tempo } = await supabase.rpc("tempo_medio_resposta_min", { p_cliente_id: c.id, p_dias: 7 });
    if (typeof tempo === "number" && tempo > 60) {
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "tempo_resposta_alto", severity: tempo > 180 ? "critical" : "warning",
        title: `${c.nome}: tempo medio de resposta ${tempo.toFixed(0)} min`,
        message: "Vendedor lento. Configure SLA e automacao IA pra assumir.",
        metric_name: "tempo_resposta_min", current_value: tempo,
      });
    }
  }
}

export async function detectarLeadsEsquecidos(supabase: SupabaseClient, tenant_id: string) {
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString();
  const { data: clientes } = await supabase.from("clientes").select("id,nome").eq("tenant_id", tenant_id);
  for (const c of clientes || []) {
    const { data: leads } = await supabase
      .from("leads").select("id,nome", { count: "exact" })
      .eq("cliente_id", c.id)
      .lte("ultima_atividade_at", cutoff)
      .not("status", "in", "(ganho,perdido,arquivado)");
    if (leads && leads.length >= 3) {
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "lead_esquecido", severity: leads.length > 10 ? "critical" : "warning",
        title: `${c.nome}: ${leads.length} leads esquecidos ha 48h+`,
        message: "Reativar follow-up automatico ou redistribuir vendedor.",
        current_value: leads.length,
      });
    }
  }
}

export async function detectarVencimentoProximo(supabase: SupabaseClient, tenant_id: string) {
  const hoje = new Date();
  const dia = hoje.getDate();
  const proximos5 = [dia + 1, dia + 2, dia + 3, dia + 4, dia + 5].map((d) => d > 31 ? d - 31 : d);

  const { data: clientes } = await supabase.from("clientes").select("id,nome,vencimento,vencimentos_extra,contato_whatsapp,ticket_mensal")
    .eq("tenant_id", tenant_id).eq("status", "ativo");
  for (const c of clientes || []) {
    const venc = [c.vencimento, ...(c.vencimentos_extra || [])].filter(Boolean) as number[];
    const proximo = venc.find((v) => proximos5.includes(v));
    if (proximo) {
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "vencimento_proximo", severity: "info",
        title: `${c.nome}: vencimento dia ${proximo}`,
        message: `Mensalidade R$ ${Number(c.ticket_mensal || 0).toFixed(2)} vence em breve. Considerar enviar lembrete via WhatsApp.`,
        metadata: { dia: proximo, ticket: c.ticket_mensal },
      });
    }
  }
}

export async function detectarDesempenhoExcelente(supabase: SupabaseClient, tenant_id: string) {
  // celebra: cliente com queda de CPL ou aumento de leads forte
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const twoWeeks = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);

  const { data: clientes } = await supabase.from("clientes").select("id,nome").eq("tenant_id", tenant_id).eq("status", "ativo");
  for (const c of clientes || []) {
    const { data: m } = await supabase.from("metrics_daily").select("date,leads,spend").eq("cliente_id", c.id).gte("date", twoWeeks);
    if (!m?.length) continue;
    const leadsRec = m.filter((x) => x.date >= weekAgo).reduce((s, x) => s + (x.leads || 0), 0);
    const leadsAnt = m.filter((x) => x.date < weekAgo).reduce((s, x) => s + (x.leads || 0), 0);
    if (leadsAnt < 5) continue;
    const delta = ((leadsRec - leadsAnt) / leadsAnt) * 100;
    if (delta > 50) {
      await createAlert(supabase, {
        tenant_id, cliente_id: c.id,
        type: "desempenho_excelente", severity: "info",
        title: `🚀 ${c.nome}: leads subiram ${delta.toFixed(0)}%`,
        message: `${leadsRec} leads vs ${leadsAnt} semana anterior. Considere escalar a verba.`,
        metric_name: "leads", current_value: leadsRec, expected_value: leadsAnt, delta_pct: delta,
      });
    }
  }
}

// ============================================================
// Runner geral
// ============================================================
export async function runAllDetectors(supabase: SupabaseClient, tenant_id: string) {
  await Promise.allSettled([
    detectarQuedaLeads(supabase, tenant_id),
    detectarAumentoCPL(supabase, tenant_id),
    detectarSemPostagem(supabase, tenant_id),
    detectarTempoRespostaAlto(supabase, tenant_id),
    detectarLeadsEsquecidos(supabase, tenant_id),
    detectarVencimentoProximo(supabase, tenant_id),
    detectarDesempenhoExcelente(supabase, tenant_id),
  ]);
}
