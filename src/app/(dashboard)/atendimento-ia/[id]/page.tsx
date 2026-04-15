import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AgenteEditor } from "@/components/atendimento-ia/agente-editor";

export const dynamic = "force-dynamic";

export default async function EditarAgentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase.from("ai_agents")
    .select("*,cliente:clientes(id,nome)")
    .eq("id", id).maybeSingle();
  if (!agent) return notFound();

  const { data: clientes } = await supabase.from("clientes").select("id,nome").order("nome");

  const { count: runsCount } = await supabase.from("agent_runs")
    .select("*", { count: "exact", head: true }).eq("agent_id", id);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/atendimento-ia" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-3xl font-black tracking-tight">{agent.name}</h1>
        <p className="text-muted-foreground">
          {agent.is_active ? "Ativo" : "Pausado"} · {runsCount || 0} execucoes · modelo <code className="text-xs">{agent.model}</code>
        </p>
      </div>

      <AgenteEditor agent={agent} clientes={clientes || []} />
    </div>
  );
}
