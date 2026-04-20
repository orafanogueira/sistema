import { Phone, MessageSquare, Mail, CheckCircle2, XCircle, AlertCircle, Clock, ArrowLeft, Bot, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReprocessarLigacao } from "@/components/ligacoes/reprocessar-ligacao";

export const dynamic = "force-dynamic";

export default async function LigacaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ligacao } = await supabase.from("ligacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ligacao) {
    return <div className="text-muted-foreground">Ligação não encontrada</div>;
  }

  // busca mensagens WhatsApp disparadas pelo telefone desse lead
  const { data: mensagensDisparo } = await supabase.from("disparo_mensagens")
    .select("id, status, mensagem_texto, sent_at, error_message, created_at")
    .eq("telefone_destino", ligacao.telefone)
    .order("created_at", { ascending: false })
    .limit(10);

  // busca agendamentos pendentes desse telefone
  const { data: pendentes } = await supabase.from("agendamentos_pendentes")
    .select("*")
    .eq("telefone_lead", ligacao.telefone)
    .order("created_at", { ascending: false })
    .limit(5);

  // busca agendamentos IA criados
  const { data: agendIA } = await supabase.from("agendamentos_ia")
    .select("*")
    .eq("telefone", ligacao.telefone)
    .order("created_at", { ascending: false })
    .limit(5);

  const duracao = ligacao.duracao_segundos
    ? `${Math.floor(ligacao.duracao_segundos / 60)}:${(ligacao.duracao_segundos % 60).toString().padStart(2, "0")}`
    : "—";

  const iconStatus = (status: string) => {
    if (status === "enviado") return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    if (status === "erro") return <XCircle className="h-3 w-3 text-red-500" />;
    if (status === "em_andamento") return <Clock className="h-3 w-3 text-amber-400 animate-pulse" />;
    return <AlertCircle className="h-3 w-3 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <Link href="/ligacoes" className="text-xs text-cyan hover:underline flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Voltar pra Ligações
      </Link>

      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Phone className="h-6 w-6 text-purple-400" />
          {ligacao.nome || ligacao.telefone}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ligação {ligacao.tipo} · {new Date(ligacao.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      {/* Resumo da ligação */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Status</div>
            <div className="text-lg font-bold mt-1 flex items-center gap-2">
              {iconStatus(ligacao.status)}
              {ligacao.status}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Resultado</div>
            <div className="text-lg font-bold mt-1">
              {ligacao.resultado ? (
                <Badge
                  variant={
                    ligacao.resultado === "agendou" ? "success" :
                    ligacao.resultado === "sem_interesse" ? "destructive" :
                    "secondary"
                  }
                >
                  {ligacao.resultado}
                </Badge>
              ) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Duração</div>
            <div className="text-lg font-bold mt-1">{duracao}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Custo</div>
            <div className="text-lg font-bold mt-1">
              {ligacao.custo_estimado ? `$${Number(ligacao.custo_estimado).toFixed(3)}` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transcript */}
      {ligacao.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transcrição da ligação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-background/40 border border-border rounded p-3 text-xs whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
              {ligacao.transcript}
            </div>
          </CardContent>
        </Card>
      )}

      {ligacao.resumo_ia && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-400" /> Resumo da IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-cbd5e1">{ligacao.resumo_ia}</p>
          </CardContent>
        </Card>
      )}

      {/* Automações pós-ligação — mostra se disparou */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">🔁 Fluxo Pós-Ligação (automações)</CardTitle>
            {ligacao.resultado === "agendou" && (
              <ReprocessarLigacao ligacaoId={ligacao.id} />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Checklist do fluxo */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              {ligacao.resultado === "agendou" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-500" />
              )}
              <span>IA detectou &quot;lead topou conversar&quot;</span>
              <span className="text-muted-foreground ml-2">
                {ligacao.resultado === "agendou"
                  ? "→ iniciou fluxo"
                  : ligacao.resultado ? `(resultado foi: ${ligacao.resultado})` : "(ligação ainda não terminou)"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(mensagensDisparo || []).some((m) => m.status === "enviado" && m.created_at >= ligacao.created_at) ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-500" />
              )}
              <span>WhatsApp enviado pro lead com horários</span>
            </div>

            <div className="flex items-center gap-2">
              {pendentes && pendentes.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-gray-500" />
              )}
              <span>Agendamento pendente (aguardando sua confirmação)</span>
              {pendentes && pendentes.length > 0 && (
                <Badge variant="secondary" className="text-[9px]">{pendentes[0].status}</Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {agendIA && agendIA.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-gray-500" />
              )}
              <span>Evento criado no Google Calendar</span>
              {agendIA && agendIA[0]?.meet_link && (
                <a href={agendIA[0].meet_link} target="_blank" rel="noopener" className="text-cyan text-[10px] hover:underline">
                  abrir link
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensagens WhatsApp enviadas */}
      {mensagensDisparo && mensagensDisparo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" /> Mensagens WhatsApp enviadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mensagensDisparo.map((m) => (
                <div key={m.id} className="border border-border rounded p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    {iconStatus(m.status)}
                    <Badge variant={m.status === "enviado" ? "success" : m.status === "erro" ? "destructive" : "secondary"} className="text-[9px]">
                      {m.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {m.mensagem_texto && (
                    <div className="bg-background/40 rounded p-2 whitespace-pre-wrap text-[11px] mt-1">
                      {m.mensagem_texto}
                    </div>
                  )}
                  {m.error_message && (
                    <div className="text-red-400 text-[10px]">Erro: {m.error_message}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agendamentos pendentes */}
      {pendentes && pendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">📅 Agendamentos pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendentes.map((p) => (
                <div key={p.id} className="border border-border rounded p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={p.status === "confirmado" ? "success" : p.status === "rejeitado" ? "destructive" : "warning"}>
                      {p.status}
                    </Badge>
                    <span className="text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="text-[11px]">Horário proposto pelo lead: <b>&quot;{p.horario_proposto_texto}&quot;</b></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
