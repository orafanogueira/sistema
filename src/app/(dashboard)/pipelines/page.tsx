import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Workflow, Clock } from "lucide-react";

export default async function PipelinesPage() {
  const supabase = await createClient();
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("*,cliente:clientes(nome),stages:pipeline_stages(id,name,color,position,is_won,is_lost,sla_minutes)")
    .order("created_at");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">Funis de venda customizaveis com SLA e automacao.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Novo pipeline</Button>
      </div>

      {(pipelines || []).length === 0 ? (
        <Card><CardContent className="p-16 text-center">
          <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold text-lg mb-1">Nenhum pipeline criado</div>
          <div className="text-sm text-muted-foreground mb-6">Aplique um preset (Agencia / Comercial / Automotivo) ou crie do zero.</div>
          <Button><Plus className="h-4 w-4" /> Criar pipeline</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {(pipelines || []).map((p) => {
            const cliente = p.cliente as { nome?: string } | null;
            const stages = ((p.stages as { id: string; name: string; color: string; position: number; is_won: boolean; is_lost: boolean; sla_minutes?: number | null }[]) || []).sort((a, b) => a.position - b.position);
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{p.vertical}</Badge>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {p.is_default && <Badge>default</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{cliente?.nome || "tenant"}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {stages.map((s) => (
                      <div key={s.id} className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border" style={{ borderColor: s.color, color: s.color, background: `${s.color}15` }}>
                        {s.name}
                        {s.sla_minutes && <span className="ml-2 text-[10px] opacity-70 inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.sla_minutes}m</span>}
                        {s.is_won && <span className="ml-2 text-[10px]">🏆</span>}
                        {s.is_lost && <span className="ml-2 text-[10px]">❌</span>}
                      </div>
                    ))}
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
