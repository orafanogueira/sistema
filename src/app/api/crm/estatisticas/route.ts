import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const maxDuration = 30;

/**
 * Estatísticas de prospecção consolidadas.
 * Retorna o funil completo por canal + taxa de conversão.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const periodo = url.searchParams.get("periodo") || "30"; // dias
  const desde = new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // === LIGAÇÕES IA ===
  const { count: ligTotal } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true }).gte("created_at", desde);
  const { count: ligAtendidas } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true }).eq("status", "atendida").gte("created_at", desde);
  const { count: ligSemResposta } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true }).eq("status", "sem_resposta").gte("created_at", desde);
  const { count: ligAgendou } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true }).eq("resultado", "agendou").gte("created_at", desde);
  const { count: ligSemInteresse } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true }).eq("resultado", "sem_interesse").gte("created_at", desde);

  // === DISPAROS WHATSAPP ===
  const { count: waEnviados } = await supabase.from("disparo_mensagens")
    .select("*", { count: "exact", head: true }).eq("status", "enviado").gte("created_at", desde);
  const { count: waRespondidos } = await supabase.from("disparo_mensagens")
    .select("*", { count: "exact", head: true }).eq("status", "respondido").gte("created_at", desde);
  const { count: waErros } = await supabase.from("disparo_mensagens")
    .select("*", { count: "exact", head: true }).eq("status", "erro").gte("created_at", desde);

  // === EMAILS ===
  const { count: emailEnviados } = await supabase.from("email_mensagens")
    .select("*", { count: "exact", head: true }).eq("status", "enviado").gte("created_at", desde);
  const { count: emailErros } = await supabase.from("email_mensagens")
    .select("*", { count: "exact", head: true }).eq("status", "erro").gte("created_at", desde);

  // === AGENDAMENTOS ===
  const { count: agendPendentes } = await supabase.from("agendamentos_pendentes")
    .select("*", { count: "exact", head: true }).eq("status", "aguardando_rafa").gte("created_at", desde);
  const { count: agendConfirmados } = await supabase.from("agendamentos_pendentes")
    .select("*", { count: "exact", head: true }).eq("status", "confirmado").gte("created_at", desde);
  const { count: agendRejeitados } = await supabase.from("agendamentos_pendentes")
    .select("*", { count: "exact", head: true }).eq("status", "rejeitado").gte("created_at", desde);

  // === EVENTOS CALENDAR CRIADOS (agendamentos_ia) ===
  const { count: eventosCriados } = await supabase.from("agendamentos_ia")
    .select("*", { count: "exact", head: true }).eq("status", "agendado").gte("created_at", desde);
  const { count: eventosRealizados } = await supabase.from("agendamentos_ia")
    .select("*", { count: "exact", head: true }).eq("status", "realizado").gte("created_at", desde);

  // === LEADS POR ETAPA (Kanban) ===
  const { data: leadsPorStatus } = await supabase.from("prospeccao_leads")
    .select("status")
    .gte("updated_at", desde);
  const leadsPorEtapa: Record<string, number> = {};
  (leadsPorStatus || []).forEach((l: { status?: string }) => {
    const s = l.status || "novo";
    leadsPorEtapa[s] = (leadsPorEtapa[s] || 0) + 1;
  });

  // === LEADS POR ORIGEM ===
  const { data: leadsPorOrigemRaw } = await supabase.from("prospeccao_leads")
    .select("origem")
    .gte("created_at", desde);
  const leadsPorOrigem: Record<string, number> = {};
  (leadsPorOrigemRaw || []).forEach((l: { origem?: string }) => {
    const o = l.origem || "manual";
    leadsPorOrigem[o] = (leadsPorOrigem[o] || 0) + 1;
  });

  // === ATIVIDADES (histórico geral) ===
  const { count: atividadesTotal } = await supabase.from("prospeccao_atividades")
    .select("*", { count: "exact", head: true }).gte("created_at", desde);

  // === TAXAS DE CONVERSÃO ===
  const pct = (num: number | null, den: number | null) => {
    if (!num || !den || den === 0) return 0;
    return Number(((num / den) * 100).toFixed(1));
  };

  // === FUNIL COMPLETO ===
  const funil = {
    ligacoes_disparadas: ligTotal || 0,
    ligacoes_atendidas: ligAtendidas || 0,
    ligacoes_com_interesse: ligAgendou || 0,
    whatsapp_apos_ligacao: 0, // calculado abaixo
    agendamento_proposto: agendPendentes || 0,
    agendamento_confirmado: agendConfirmados || 0,
    evento_criado_calendar: eventosCriados || 0,
    reuniao_realizada: eventosRealizados || 0,
  };

  // quantos WhatsApp enviados foram pós-ligação (aproximação: msg enviada dentro de 5 min após ligação que deu "agendou")
  const { data: ligacoesAgendadas } = await supabase.from("ligacoes")
    .select("telefone, created_at")
    .eq("resultado", "agendou")
    .gte("created_at", desde);

  let whatsappPosLigacao = 0;
  for (const lig of ligacoesAgendadas || []) {
    const { count } = await supabase.from("disparo_mensagens")
      .select("*", { count: "exact", head: true })
      .eq("telefone_destino", lig.telefone.replace(/\D/g, ""))
      .gte("created_at", lig.created_at);
    if (count && count > 0) whatsappPosLigacao++;
  }
  funil.whatsapp_apos_ligacao = whatsappPosLigacao;

  return NextResponse.json({
    periodo_dias: Number(periodo),
    funil,
    conversoes: {
      taxa_atendimento: pct(ligAtendidas, ligTotal),
      taxa_interesse_apos_atender: pct(ligAgendou, ligAtendidas),
      taxa_proposta_apos_interesse: pct(agendPendentes, ligAgendou),
      taxa_confirmacao: pct(agendConfirmados, agendPendentes),
      taxa_evento_calendar: pct(eventosCriados, agendConfirmados),
      taxa_reuniao_apos_evento: pct(eventosRealizados, eventosCriados),
      taxa_total_lig_ate_reuniao: pct(eventosRealizados, ligTotal),
    },
    ligacoes: {
      total: ligTotal || 0,
      atendidas: ligAtendidas || 0,
      sem_resposta: ligSemResposta || 0,
      agendou: ligAgendou || 0,
      sem_interesse: ligSemInteresse || 0,
    },
    whatsapp: {
      enviados: waEnviados || 0,
      respondidos: waRespondidos || 0,
      erros: waErros || 0,
    },
    email: {
      enviados: emailEnviados || 0,
      erros: emailErros || 0,
    },
    agendamentos: {
      pendentes_confirmacao_rafa: agendPendentes || 0,
      confirmados_pelo_rafa: agendConfirmados || 0,
      rejeitados: agendRejeitados || 0,
      eventos_calendar_criados: eventosCriados || 0,
      reunioes_realizadas: eventosRealizados || 0,
    },
    leads_por_etapa: leadsPorEtapa,
    leads_por_origem: leadsPorOrigem,
    total_atividades: atividadesTotal || 0,
  });
}
