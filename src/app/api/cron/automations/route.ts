import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runAutomation } from "@/lib/leads/ingest";

/**
 * Cron a cada 5 min: roda automacoes baseadas em tempo.
 * - lead_idle (X horas sem atividade)
 * - no_response_from_seller (vendedor nao respondeu em N min)
 * - sla_breach (estagio com sla_minutes vencido)
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date();
  let processed = 0;

  // 1. lead_idle
  const { data: idleAutos } = await supabase.from("automations")
    .select("*").eq("trigger", "lead_idle").eq("is_active", true);
  for (const auto of idleAutos || []) {
    const hours = Number((auto.trigger_config as Record<string, unknown>).hours || 24);
    const cutoff = new Date(now.getTime() - hours * 3600000).toISOString();
    const { data: leads } = await supabase.from("leads")
      .select("*").eq("cliente_id", auto.cliente_id)
      .lte("ultima_atividade_at", cutoff)
      .not("status", "in", "(ganho,perdido,arquivado)")
      .limit(100);
    for (const lead of leads || []) {
      // evita reenviar se ja rodou nas ultimas 24h
      const { data: lastRun } = await supabase.from("automation_runs")
        .select("created_at").eq("automation_id", auto.id).eq("lead_id", lead.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lastRun && new Date(lastRun.created_at).getTime() > now.getTime() - hours * 3600000) continue;
      try { await runAutomation(supabase, auto, lead); processed++; }
      catch { /* swallow */ }
    }
  }

  // 2. no_response_from_seller
  const { data: noRespAutos } = await supabase.from("automations")
    .select("*").eq("trigger", "no_response_from_seller").eq("is_active", true);
  for (const auto of noRespAutos || []) {
    const minutes = Number((auto.trigger_config as Record<string, unknown>).minutes || 30);
    const cutoff = new Date(now.getTime() - minutes * 60000).toISOString();
    const { data: leads } = await supabase.from("leads")
      .select("*").eq("cliente_id", auto.cliente_id)
      .not("vendedor_id", "is", null)
      .is("primeira_resposta_at", null)
      .lte("vendedor_atribuido_at", cutoff)
      .not("status", "in", "(ganho,perdido,arquivado)")
      .limit(100);
    for (const lead of leads || []) {
      const { data: lastRun } = await supabase.from("automation_runs")
        .select("created_at").eq("automation_id", auto.id).eq("lead_id", lead.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lastRun) continue;
      try { await runAutomation(supabase, auto, lead); processed++; } catch {}
    }
  }

  // 3. sla_breach (estagios com sla_minutes vencido)
  const { data: stagesWithSla } = await supabase.from("pipeline_stages")
    .select("id,sla_minutes,pipeline_id").not("sla_minutes", "is", null);
  for (const stage of stagesWithSla || []) {
    const cutoff = new Date(now.getTime() - (stage.sla_minutes as number) * 60000).toISOString();
    const { data: leads } = await supabase.from("leads")
      .select("*").eq("stage_id", stage.id).lte("ultima_atividade_at", cutoff)
      .not("status", "in", "(ganho,perdido,arquivado)").limit(50);
    if (!leads?.length) continue;
    const { data: slaAutos } = await supabase.from("automations")
      .select("*").eq("trigger", "sla_breach").eq("is_active", true)
      .eq("pipeline_id", stage.pipeline_id);
    for (const auto of slaAutos || []) {
      for (const lead of leads) {
        try { await runAutomation(supabase, auto, lead); processed++; } catch {}
      }
    }
  }

  return NextResponse.json({ processed });
}
