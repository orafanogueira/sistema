import { TrendingUp, Phone, MessageSquare, Mail, Calendar, Users, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FunilUI } from "@/components/crm/funil-ui";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function fetchStats(periodo = 30) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(`Envs ausentes: url=${!!supabaseUrl} key=${!!serviceKey}`);
  }

  const supabase = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const desde = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();

  const countOf = async (table: string, filters: Array<[string, unknown]> = []) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true }).gte("created_at", desde);
    for (const [col, val] of filters) {
      q = q.eq(col, val);
    }
    const { count } = await q;
    return count || 0;
  };

  const [
    ligTotal, ligAtendidas, ligSemResposta, ligAgendou, ligSemInteresse,
    waEnviados, waRespondidos, waErros,
    emailEnviados, emailErros,
    agendPendentes, agendConfirmados, agendRejeitados,
    eventosCriados, eventosRealizados,
    atividadesTotal,
  ] = await Promise.all([
    countOf("ligacoes"),
    countOf("ligacoes", [["status", "atendida"]]),
    countOf("ligacoes", [["status", "sem_resposta"]]),
    countOf("ligacoes", [["resultado", "agendou"]]),
    countOf("ligacoes", [["resultado", "sem_interesse"]]),
    countOf("disparo_mensagens", [["status", "enviado"]]),
    countOf("disparo_mensagens", [["status", "respondido"]]),
    countOf("disparo_mensagens", [["status", "erro"]]),
    countOf("email_mensagens", [["status", "enviado"]]),
    countOf("email_mensagens", [["status", "erro"]]),
    countOf("agendamentos_pendentes", [["status", "aguardando_rafa"]]),
    countOf("agendamentos_pendentes", [["status", "confirmado"]]),
    countOf("agendamentos_pendentes", [["status", "rejeitado"]]),
    countOf("agendamentos_ia", [["status", "agendado"]]),
    countOf("agendamentos_ia", [["status", "realizado"]]),
    countOf("prospeccao_atividades"),
  ]);

  const { data: leadsEtapa } = await supabase.from("prospeccao_leads").select("status").gte("updated_at", desde);
  const leadsPorEtapa: Record<string, number> = {};
  (leadsEtapa || []).forEach((l) => {
    const s = l.status || "novo";
    leadsPorEtapa[s] = (leadsPorEtapa[s] || 0) + 1;
  });

  const { data: leadsOrigem } = await supabase.from("prospeccao_leads").select("origem").gte("created_at", desde);
  const leadsPorOrigem: Record<string, number> = {};
  (leadsOrigem || []).forEach((l) => {
    const o = l.origem || "manual";
    leadsPorOrigem[o] = (leadsPorOrigem[o] || 0) + 1;
  });

  // whatsapp enviado após ligação agendou
  const { data: ligAgendaram } = await supabase.from("ligacoes")
    .select("telefone, created_at")
    .eq("resultado", "agendou")
    .gte("created_at", desde);

  let whatsappPosLigacao = 0;
  for (const lig of ligAgendaram || []) {
    const { count } = await supabase.from("disparo_mensagens")
      .select("*", { count: "exact", head: true })
      .eq("telefone_destino", lig.telefone.replace(/\D/g, ""))
      .gte("created_at", lig.created_at);
    if (count && count > 0) whatsappPosLigacao++;
  }

  const pct = (num: number, den: number) => (den === 0 ? 0 : Number(((num / den) * 100).toFixed(1)));

  return {
    periodo_dias: periodo,
    funil: {
      ligacoes_disparadas: ligTotal,
      ligacoes_atendidas: ligAtendidas,
      ligacoes_com_interesse: ligAgendou,
      whatsapp_apos_ligacao: whatsappPosLigacao,
      agendamento_proposto: agendPendentes,
      agendamento_confirmado: agendConfirmados,
      evento_criado_calendar: eventosCriados,
      reuniao_realizada: eventosRealizados,
    },
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
      total: ligTotal,
      atendidas: ligAtendidas,
      sem_resposta: ligSemResposta,
      agendou: ligAgendou,
      sem_interesse: ligSemInteresse,
    },
    whatsapp: { enviados: waEnviados, respondidos: waRespondidos, erros: waErros },
    email: { enviados: emailEnviados, erros: emailErros },
    agendamentos: {
      pendentes_confirmacao_rafa: agendPendentes,
      confirmados_pelo_rafa: agendConfirmados,
      rejeitados: agendRejeitados,
      eventos_calendar_criados: eventosCriados,
      reunioes_realizadas: eventosRealizados,
    },
    leads_por_etapa: leadsPorEtapa,
    leads_por_origem: leadsPorOrigem,
    total_atividades: atividadesTotal,
  };
}

export default async function FunilPage() {
  let stats;
  let erroMsg = "";
  try {
    stats = await fetchStats(30);
  } catch (e: unknown) {
    erroMsg = e instanceof Error ? `${e.message}\n${e.stack?.slice(0, 500) || ""}` : "erro desconhecido";
  }

  if (!stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Funil de Prospecção — Erro</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded p-4 text-sm">
          <div className="font-semibold text-red-400 mb-2">Erro ao carregar:</div>
          <pre className="whitespace-pre-wrap text-xs font-mono">{erroMsg || "sem erro especifico"}</pre>
        </div>
      </div>
    );
  }

  const f = stats.funil;
  const c = stats.conversoes;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-cyan" /> Funil de Prospecção
        </h1>
        <p className="text-muted-foreground">
          Rastreabilidade completa — últimos {stats.periodo_dias} dias.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <FunilUI funil={f} conversoes={c} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase">Ligações IA</span>
              <Phone className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black">{stats.ligacoes.total}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {stats.ligacoes.atendidas} atendidas · {stats.ligacoes.sem_resposta} sem resposta
            </div>
            <div className="text-[11px] text-green-400 mt-1">
              {stats.ligacoes.agendou} aceitaram consultoria
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase">WhatsApp</span>
              <MessageSquare className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-3xl font-black">{stats.whatsapp.enviados}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {stats.whatsapp.respondidos} responderam · {stats.whatsapp.erros} erros
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase">Email</span>
              <Mail className="h-4 w-4 text-cyan" />
            </div>
            <div className="text-3xl font-black">{stats.email.enviados}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {stats.email.erros} erros
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase">Reuniões</span>
              <Calendar className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-400">
              {stats.agendamentos.eventos_calendar_criados}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {stats.agendamentos.reunioes_realizadas} realizadas · {stats.agendamentos.pendentes_confirmacao_rafa} pendentes
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Rastreabilidade de Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-background/40 border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground uppercase">Propostos pelo lead</div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {stats.agendamentos.pendentes_confirmacao_rafa}
              </div>
              <div className="text-[10px] text-muted-foreground">aguardando sua confirmação</div>
            </div>
            <div className="bg-background/40 border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground uppercase">Confirmados por você</div>
              <div className="text-2xl font-black text-cyan mt-1">
                {stats.agendamentos.confirmados_pelo_rafa}
              </div>
              <div className="text-[10px] text-muted-foreground">você respondeu SIM</div>
            </div>
            <div className="bg-background/40 border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground uppercase">No Google Calendar</div>
              <div className="text-2xl font-black text-green-500 mt-1">
                {stats.agendamentos.eventos_calendar_criados}
              </div>
              <div className="text-[10px] text-muted-foreground">evento + link Meet</div>
            </div>
            <div className="bg-background/40 border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground uppercase">Reuniões realizadas</div>
              <div className="text-2xl font-black text-purple-400 mt-1">
                {stats.agendamentos.reunioes_realizadas}
              </div>
              <div className="text-[10px] text-muted-foreground">lead compareceu</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" /> Leads por origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.leads_por_origem).map(([origem, qtd]) => (
                <div key={origem} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{origem}</span>
                  <Badge variant="secondary">{qtd as number}</Badge>
                </div>
              ))}
              {Object.keys(stats.leads_por_origem).length === 0 && (
                <div className="text-xs text-muted-foreground">Sem leads no período</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Leads por etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.leads_por_etapa).map(([etapa, qtd]) => (
                <div key={etapa} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{etapa}</span>
                  <Badge variant="secondary">{qtd as number}</Badge>
                </div>
              ))}
              {Object.keys(stats.leads_por_etapa).length === 0 && (
                <div className="text-xs text-muted-foreground">Sem leads no período</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
