import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomacaoEditor } from "@/components/automacoes/automacao-editor";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditarAutomacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from("automations")
    .select("*,cliente:clientes(id,nome)")
    .eq("id", id).maybeSingle();
  if (!a) return notFound();

  const { data: clientes } = await supabase.from("clientes").select("id,nome").order("nome");
  const { data: runs } = await supabase.from("automation_runs")
    .select("id,status,started_at,error_message").eq("automation_id", id)
    .order("started_at", { ascending: false }).limit(10);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/automacoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-3xl font-black tracking-tight">{a.name}</h1>
        <p className="text-muted-foreground">
          {a.is_active ? "Ativa" : "Pausada"} · {a.run_count || 0} execucoes · ultima: {formatDate(a.last_run_at)}
        </p>
      </div>

      <AutomacaoEditor automation={a} clientes={clientes || []} />

      {runs && runs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Ultimas 10 execucoes</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={r.status === "success" ? "text-green-400" : r.status === "error" ? "text-red-400" : "text-muted-foreground"}>
                    {r.status === "success" ? "✓" : r.status === "error" ? "✕" : "•"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.started_at)}</span>
                </div>
                {r.error_message && <span className="text-xs text-red-400 truncate max-w-[50%]">{r.error_message}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
