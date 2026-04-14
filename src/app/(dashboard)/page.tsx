import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatInt } from "@/lib/utils";
import { Users, TrendingUp, Target, DollarSign } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: totalClientes }, { count: clientesAtivos }, { data: metricsRow }] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase
      .from("metrics_daily")
      .select("spend, clicks, leads, conversions")
      .gte("date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
  ]);

  const spend = (metricsRow || []).reduce((s, r) => s + Number(r.spend || 0), 0);
  const clicks = (metricsRow || []).reduce((s, r) => s + Number(r.clicks || 0), 0);
  const leads = (metricsRow || []).reduce((s, r) => s + Number(r.leads || 0), 0);

  const stats = [
    { label: "Clientes Totais", value: formatInt(totalClientes || 0), icon: Users, color: "text-cyan" },
    { label: "Ativos", value: formatInt(clientesAtivos || 0), icon: Target, color: "text-green-400" },
    { label: "Investido (30d)", value: formatBRL(spend), icon: DollarSign, color: "text-yellow-400" },
    { label: "Leads (30d)", value: formatInt(leads), icon: TrendingUp, color: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visao consolidada da operacao.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</div>
                  <div className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</div>
                </div>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Proximos passos</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan" /> Cadastre seus clientes em <a href="/clientes" className="text-cyan font-semibold">Clientes</a>.
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan" /> Conecte Meta Ads e Google Ads em <a href="/integracoes" className="text-cyan font-semibold">Integracoes</a>.
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan" /> Convide seu time em <a href="/configuracoes" className="text-cyan font-semibold">Configuracoes</a>.
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan" /> Configure o agente de IA em <a href="/atendimento-ia" className="text-cyan font-semibold">Atendimento IA</a>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
