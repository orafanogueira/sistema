import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CSPage() {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  // Pega snapshot mais recente de cada cliente
  const { data: snapshots } = await supabase
    .from("cs_health_snapshots")
    .select("*,cliente:clientes(id,nome,vertical,ticket_mensal,contato_whatsapp)")
    .order("date", { ascending: false }).limit(500);

  // Dedupe por cliente_id (pega o mais recente)
  const latestByClient = new Map();
  for (const s of snapshots || []) {
    if (!latestByClient.has(s.cliente_id)) latestByClient.set(s.cliente_id, s);
  }
  const lista = Array.from(latestByClient.values()).sort((a, b) => a.health_score - b.health_score);

  const highRisk = lista.filter((s) => s.churn_risk === "high");
  const mediumRisk = lista.filter((s) => s.churn_risk === "medium");
  const lowRisk = lista.filter((s) => s.churn_risk === "low");

  const totalLTV = lista.reduce((s, x) => s + Number(x.ltv_estimated || 0), 0);
  const mrrEmRisco = highRisk.reduce((s, x) => s + Number(x.cliente?.ticket_mensal || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Customer Success</h1>
        <p className="text-muted-foreground">Health score + risco de churn + acoes proativas.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Risco baixo</div>
          <div className="text-2xl font-black mt-1 text-green-400">{lowRisk.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Risco medio</div>
          <div className="text-2xl font-black mt-1 text-yellow-400">{mediumRisk.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Risco alto</div>
          <div className="text-2xl font-black mt-1 text-red-400">{highRisk.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">MRR em risco</div>
          <div className="text-2xl font-black mt-1 text-red-400">{formatBRL(mrrEmRisco)}</div>
        </CardContent></Card>
      </div>

      {highRisk.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" /> Clientes em risco alto (acao imediata)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {highRisk.map((s) => {
              const c = s.cliente;
              return (
                <div key={s.id} className="flex items-center justify-between p-3 bg-background/40 rounded">
                  <div className="flex-1">
                    <Link href={`/clientes/${c?.id}`} className="font-semibold hover:text-cyan">{c?.nome}</Link>
                    <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                      <span>Health: <b className="text-red-400">{s.health_score}/100</b></span>
                      <span>{s.meses_ativo} meses</span>
                      <span>MRR: {formatBRL(Number(c?.ticket_mensal || 0))}</span>
                      {s.is_inadimplente && <Badge variant="destructive" className="text-[9px]">inadimplente</Badge>}
                      {s.has_critical_alerts && <Badge variant="warning" className="text-[9px]">alertas</Badge>}
                    </div>
                  </div>
                  <HealthBar score={s.health_score} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Toda a carteira</CardTitle></CardHeader>
        <CardContent className="p-0">
          {lista.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum health score calculado ainda. O cron <code>/api/cron/cs-health</code> roda todo dia as 5h.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-right">Health</th>
                  <th className="p-3 text-left">Risco</th>
                  <th className="p-3 text-right">MRR</th>
                  <th className="p-3 text-right">LTV estim.</th>
                  <th className="p-3 text-right">Meses</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => {
                  const c = s.cliente;
                  return (
                    <tr key={s.id} className="border-b border-border">
                      <td className="p-3"><Link href={`/clientes/${c?.id}`} className="hover:text-cyan">{c?.nome}</Link></td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={s.health_score >= 70 ? "text-green-400" : s.health_score >= 40 ? "text-yellow-400" : "text-red-400"}>
                          {s.health_score}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge variant={s.churn_risk === "low" ? "success" : s.churn_risk === "medium" ? "warning" : "destructive"}>
                          {s.churn_risk}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-xs">{formatBRL(Number(c?.ticket_mensal || 0))}</td>
                      <td className="p-3 text-right font-mono text-xs">{formatBRL(Number(s.ltv_estimated || 0))}</td>
                      <td className="p-3 text-right">{s.meses_ativo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-24">
      <div className="text-right text-xs font-bold mb-1">{score}/100</div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
