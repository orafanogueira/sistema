import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function AlertasPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*,cliente:clientes(nome)")
    .order("is_resolved")
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const ativos = (alerts || []).filter((a) => !a.is_resolved);
  const resolvidos = (alerts || []).filter((a) => a.is_resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Alertas</h1>
        <p className="text-muted-foreground">
          {ativos.length} ativo(s) · {resolvidos.length} resolvido(s)
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Criticos</div>
          <div className="text-2xl font-black mt-1 text-red-400">{ativos.filter((a) => a.severity === "critical").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Avisos</div>
          <div className="text-2xl font-black mt-1 text-yellow-400">{ativos.filter((a) => a.severity === "warning").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Informativos</div>
          <div className="text-2xl font-black mt-1 text-cyan">{ativos.filter((a) => a.severity === "info").length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Alertas ativos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ativos.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">Nenhum alerta ativo. Tudo limpo. 🎉</div>
          ) : ativos.map((a) => {
            const cliente = a.cliente as { nome?: string } | null;
            return (
              <div key={a.id} className={`p-4 rounded-lg border ${a.severity === "critical" ? "border-red-500/30 bg-red-500/5" : a.severity === "warning" ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-secondary/20"}`}>
                <div className="flex items-start gap-3">
                  {a.severity === "critical" && <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />}
                  {a.severity === "warning" && <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />}
                  {a.severity === "info" && <Info className="h-5 w-5 text-cyan flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{a.type.replace(/_/g, " ")}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDate(a.created_at)}</span>
                    </div>
                    <div className="font-semibold">{a.title}</div>
                    {a.message && <div className="text-sm text-muted-foreground mt-1">{a.message}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {a.cliente_id && cliente?.nome && (
                      <Link href={`/clientes/${a.cliente_id}`}>
                        <Button size="sm" variant="ghost">Ver cliente →</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {resolvidos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /> Resolvidos recentemente</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {resolvidos.slice(0, 20).map((a) => (
              <div key={a.id} className="text-xs text-muted-foreground p-2 hover:bg-secondary/40 rounded">
                {a.title} · <span className="text-[10px]">{formatDate(a.resolved_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
