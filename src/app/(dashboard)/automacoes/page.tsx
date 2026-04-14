import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Power } from "lucide-react";
import { formatDate } from "@/lib/utils";

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "Lead novo capturado",
  lead_stage_changed: "Lead muda de estagio",
  lead_assigned: "Vendedor atribuido",
  lead_idle: "Lead inativo (X horas)",
  no_response_from_seller: "Vendedor nao respondeu (X min)",
  sla_breach: "SLA do estagio estourado",
  message_received: "Mensagem recebida",
  tag_added: "Tag adicionada",
};

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const { data: automations } = await supabase
    .from("automations")
    .select("*,cliente:clientes(nome),pipeline:pipelines(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Automacoes</h1>
          <p className="text-muted-foreground">{(automations || []).length} regras automatizam tarefas, mensagens e movimentacoes.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Nova automacao</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Total</div><div className="text-2xl font-black mt-1">{(automations || []).length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Ativas</div><div className="text-2xl font-black mt-1 text-green-400">{(automations || []).filter((a) => a.is_active).length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Execucoes totais</div><div className="text-2xl font-black mt-1 text-cyan">{(automations || []).reduce((s, a) => s + (a.run_count || 0), 0)}</div></CardContent></Card>
      </div>

      {(automations || []).length === 0 ? (
        <Card><CardContent className="p-16 text-center">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold text-lg mb-1">Nenhuma automacao</div>
          <div className="text-sm text-muted-foreground mb-6">Crie regras "quando X acontece, faca Y".</div>
          <Button><Plus className="h-4 w-4" /> Primeira automacao</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(automations || []).map((a) => {
            const cliente = a.cliente as { nome?: string } | null;
            return (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={a.is_active ? "success" : "secondary"}>{a.is_active ? "ativa" : "pausada"}</Badge>
                        <h3 className="font-bold">{a.name}</h3>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1 mt-2">
                        <div><span className="font-semibold text-cyan">Quando:</span> {TRIGGER_LABELS[a.trigger] || a.trigger}</div>
                        <div><span className="font-semibold text-cyan">Faz:</span> {(a.actions as { type: string }[]).map((act) => act.type.replace(/_/g, " ")).join(" → ")}</div>
                        {cliente?.nome && <div className="text-muted-foreground">Cliente: {cliente.nome}</div>}
                        <div className="text-muted-foreground">Executou {a.run_count || 0}x · ultima: {formatDate(a.last_run_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon"><Power className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm">Editar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
