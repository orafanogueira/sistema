import { TrendingUp, Phone, MessageSquare, Mail, Calendar, Target, Users, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FunilUI } from "@/components/crm/funil-ui";

export const dynamic = "force-dynamic";

async function fetchStats() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.gruponogueiramkt.com";
  try {
    const r = await fetch(`${baseUrl}/api/crm/estatisticas?periodo=30`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export default async function FunilPage() {
  const stats = await fetchStats();

  if (!stats) {
    return <div className="text-muted-foreground">Erro ao carregar estatísticas</div>;
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
          Cada etapa da ligação IA até a reunião realizada no Google Calendar.
        </p>
      </div>

      {/* Funil visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <FunilUI funil={f} conversoes={c} />
        </CardContent>
      </Card>

      {/* KPIs por canal */}
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
            <div className="text-3xl font-black text-amber-400">{stats.agendamentos.eventos_calendar_criados}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {stats.agendamentos.reunioes_realizadas} realizadas · {stats.agendamentos.pendentes_confirmacao_rafa} pendentes
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agendamentos detalhado */}
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
              <div className="text-2xl font-black text-amber-400 mt-1">{stats.agendamentos.pendentes_confirmacao_rafa}</div>
              <div className="text-[10px] text-muted-foreground">aguardando sua confirmação</div>
            </div>
            <div className="bg-background/40 border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground uppercase">Confirmados por você</div>
              <div className="text-2xl font-black text-cyan mt-1">{stats.agendamentos.confirmados_pelo_rafa}</div>
              <div className="text-[10px] text-muted-foreground">você respondeu SIM</div>
            </div>
            <div className="bg-background/40 border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground uppercase">No Google Calendar</div>
              <div className="text-2xl font-black text-green-500 mt-1">{stats.agendamentos.eventos_calendar_criados}</div>
              <div className="text-[10px] text-muted-foreground">evento + link Meet</div>
            </div>
            <div className="bg-background/40 border border-border rounded p-3">
              <div className="text-[10px] text-muted-foreground uppercase">Reuniões realizadas</div>
              <div className="text-2xl font-black text-purple-400 mt-1">{stats.agendamentos.reunioes_realizadas}</div>
              <div className="text-[10px] text-muted-foreground">lead compareceu</div>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-muted-foreground">
            📍 Todos os eventos são criados no seu Google Calendar conectado ({
              process.env.NEXT_PUBLIC_APP_URL
            }/configuracoes/calendar) com Google Meet automático.
          </div>
        </CardContent>
      </Card>

      {/* Por origem / por etapa */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" /> Leads por origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.leads_por_origem as Record<string, number>).map(([origem, qtd]) => (
                <div key={origem} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{origem}</span>
                  <Badge variant="secondary">{qtd}</Badge>
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
              {Object.entries(stats.leads_por_etapa as Record<string, number>).map(([etapa, qtd]) => (
                <div key={etapa} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{etapa}</span>
                  <Badge variant="secondary">{qtd}</Badge>
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
