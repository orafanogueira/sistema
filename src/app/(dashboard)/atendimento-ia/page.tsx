import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Power } from "lucide-react";
import Link from "next/link";

export default async function AIPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("ai_agents")
    .select("id,name,persona,model,is_active,channels,cliente:clientes(nome)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Atendimento IA</h1>
          <p className="text-muted-foreground">Agentes Claude que atendem Messenger, Instagram e WhatsApp.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Novo agente</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Agentes totais</div>
          <div className="text-3xl font-black mt-1">{(agents || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Ativos</div>
          <div className="text-3xl font-black mt-1 text-green-400">{(agents || []).filter((a) => a.is_active).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">White-label (clientes)</div>
          <div className="text-3xl font-black mt-1 text-cyan">{(agents || []).filter((a) => a.cliente).length}</div>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(agents || []).length === 0 ? (
          <Card className="md:col-span-2"><CardContent className="p-16 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="font-bold text-lg mb-1">Nenhum agente criado</div>
            <div className="text-sm text-muted-foreground mb-6">Crie um agente IA para atender automaticamente.</div>
            <Button><Plus className="h-4 w-4" /> Criar primeiro agente</Button>
          </CardContent></Card>
        ) : (agents || []).map((a) => {
          const cliente = a.cliente as { nome?: string } | null;
          return (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">{cliente?.nome ? `Cliente: ${cliente.nome}` : "Interno"}</div>
                  </div>
                  <Badge variant={a.is_active ? "success" : "secondary"}>{a.is_active ? "ativo" : "inativo"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground line-clamp-2">{a.persona}</div>
                <div className="flex flex-wrap gap-1">
                  {(a.channels || []).map((c: string) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                </div>
                <div className="text-[11px] text-muted-foreground">Modelo: <span className="font-mono">{a.model}</span></div>
                <div className="flex gap-2 pt-2">
                  <Link href={`/atendimento-ia/${a.id}`} className="flex-1"><Button variant="outline" size="sm" className="w-full">Editar</Button></Link>
                  <Button variant="ghost" size="icon"><Power className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center flex-shrink-0">
            <Bot className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="font-bold">IA como servico</div>
            <div className="text-sm text-muted-foreground">Venda o modulo de IA para seus clientes. Cada cliente pode ter o seu proprio agente treinado com a base de conhecimento dele.</div>
          </div>
          <Button>Configurar white-label</Button>
        </CardContent>
      </Card>
    </div>
  );
}
