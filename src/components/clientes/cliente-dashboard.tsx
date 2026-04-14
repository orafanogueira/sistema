"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatInt, formatPct } from "@/lib/utils";
import { RefreshCw, Loader2, TrendingUp, MousePointerClick, DollarSign, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Line, LineChart } from "recharts";

interface Integration { id: string; provider: string; account_id: string | null; account_name: string | null; is_connected: boolean; }
interface MetricsResp {
  totals: { spend: number; clicks: number; impressions: number; leads: number; ctr: number; cpc: number; cpa: number; };
  monthly: { month: string; spend: number; clicks: number; leads: number }[];
  campaigns: { name: string; spend: number; clicks: number; cadastros: number; cpa: number }[];
  ai_insights?: string;
}

export function ClienteDashboard({ clienteId, integrations }: { clienteId: string; integrations: Integration[] }) {
  const metaInt = integrations.find((i) => i.provider === "meta_ads" && i.is_connected);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MetricsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<"30d" | "90d" | "12m">("30d");

  async function load() {
    if (!metaInt) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/meta-ads/${clienteId}?range=${range}`);
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range]);

  if (!metaInt) {
    return (
      <Card>
        <CardHeader><CardTitle>Dashboard em tempo real</CardTitle></CardHeader>
        <CardContent className="text-center py-12">
          <div className="text-muted-foreground mb-4">Conecte Meta Ads para visualizar metricas reais.</div>
          <a href={`/integracoes?cliente=${clienteId}`}><Button>Conectar Meta Ads</Button></a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">Dashboard · {metaInt.account_name || metaInt.account_id}</h2>
          <p className="text-sm text-muted-foreground">Meta Ads em tempo real</p>
        </div>
        <div className="flex gap-2">
          {(["30d", "90d", "12m"] as const).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>{r}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {err && <Card><CardContent className="p-4 text-sm text-red-400">{err}</CardContent></Card>}

      {loading && !data && (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Buscando dados do Meta Ads...</CardContent></Card>
      )}

      {data && (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <KpiCard label="Investido" value={formatBRL(data.totals.spend)} icon={DollarSign} color="text-yellow-400" />
            <KpiCard label="Cliques" value={formatInt(data.totals.clicks)} icon={MousePointerClick} color="text-cyan" />
            <KpiCard label="Cadastros" value={formatInt(data.totals.leads)} icon={Target} color="text-green-400" />
            <KpiCard label="CPA" value={formatBRL(data.totals.cpa)} icon={TrendingUp} color="text-purple-400" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Evolucao mensal - investimento x cadastros</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="spend" stroke="#00c8e0" strokeWidth={2} dot={false} name="Investimento" />
                    <Line type="monotone" dataKey="leads" stroke="#22c55e" strokeWidth={2} dot={false} name="Cadastros" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Cadastros por mes</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8 }} />
                    <Bar dataKey="leads" fill="#0055cc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Campanhas ativas</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                  <tr><th className="p-3 text-left">Campanha</th><th className="p-3 text-right">Cliques</th><th className="p-3 text-right">Cadastros</th><th className="p-3 text-right">Gasto</th><th className="p-3 text-right">CPA</th></tr>
                </thead>
                <tbody>
                  {data.campaigns.slice(0, 10).map((c, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-3">{c.name}</td>
                      <td className="p-3 text-right font-mono">{formatInt(c.clicks)}</td>
                      <td className="p-3 text-right font-mono text-green-400">{formatInt(c.cadastros)}</td>
                      <td className="p-3 text-right font-mono">{formatBRL(c.spend)}</td>
                      <td className="p-3 text-right font-mono">{formatBRL(c.cpa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {data.ai_insights && (
            <Card className="border-cyan/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge>IA</Badge>
                  <CardTitle className="text-sm">Analise automatica</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{data.ai_insights}</CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className={`text-2xl font-black mt-1 ${color}`}>{value}</div>
        </div>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
    </CardContent></Card>
  );
}
