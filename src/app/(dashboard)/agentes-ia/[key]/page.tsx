import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getAgent } from "@/lib/ai-agents/catalog";
import { createClient } from "@/lib/supabase/server";
import { AgentRunner } from "@/components/agentes/agent-runner";

export default async function AgenteDetalhe({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const agent = getAgent(key);
  if (!agent) notFound();

  const supabase = await createClient();
  const { data: clientes } = await supabase.from("clientes").select("id,nome,segmento,vertical").order("nome");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/agentes-ia"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black">{agent.name}</h1>
            <Badge variant="outline">{agent.domain}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{agent.description}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <AgentRunner agent={agent} clientes={clientes || []} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Configuracao</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2">
              <div><span className="text-muted-foreground">Modelo:</span> <span className="font-mono">claude-sonnet-4-6</span></div>
              <div><span className="text-muted-foreground">Temperature:</span> {agent.recommended_temperature}</div>
              <div><span className="text-muted-foreground">Output:</span> {agent.output_format}</div>
              <div><span className="text-muted-foreground">Categoria:</span> {agent.category.replace(/_/g, " ")}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Inputs esperados</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2">
              {Object.entries(agent.default_input_schema).map(([k, v]) => (
                <div key={k}>
                  <div className="font-semibold">
                    {k} {v.required && <span className="text-red-400">*</span>}
                  </div>
                  <div className="text-muted-foreground">{v.description || `tipo: ${v.type}`}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
