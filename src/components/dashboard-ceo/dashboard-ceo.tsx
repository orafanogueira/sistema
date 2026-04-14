"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatInt, formatPct } from "@/lib/utils";
import {
  Loader2, TrendingUp, TrendingDown, Users, DollarSign, Target, MousePointerClick,
  AlertTriangle, AlertCircle, Info, Trophy, Activity, RefreshCw,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

interface CEOData {
  kpis: {
    clientes_total: number; clientes_ativos: number;
    honorario_mensal: number; mrr: number;
    verba_30d: number; verba_30d_anterior: number;
    leads_30d: number; leads_30d_anterior: number;
    clicks_30d: number; impressions_30d: number; conversoes_30d: number;
    cpl_medio: number; ctr_medio: number; cpc_medio: number;
    delta_leads_pct: number; delta_spend_pct: number;
  };
  alerts: { id: string; cliente_id: string | null; severity: string; type: string; title: string; message: string | null; created_at: string; is_read: boolean }[];
  alerts_summary: { total: number; critical: number; warning: number; info: number };
  rankings: {
    melhor_roas: ClienteRow[]; mais_leads: ClienteRow[]; melhor_ctr: ClienteRow[];
    pior_cpl: ClienteRow[]; maior_crescimento: ClienteRow[];
  };
  leads_por_origem: Record<string, number>;
  clientes: ClienteRow[];
}

interface ClienteRow {
  id: string; nome: string; vertical: string; ticket_mensal: number;
  spend_30d: number; leads_30d: number; ctr_30d: number; cpl_30d: number;
  delta_leads_pct: number; delta_cpl_pct: number;
  leads_ganhos: number; roas_estimado: number;
  posts_publicados: number; ultima_postagem: string | null;
  alerts_count: number; health_score: number;
}

const ORIGEM_COLORS = ["#0055cc", "#00c8e0", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#ef4444", "#8b5cf6", "#06b6d4", "#10b981"];

export function DashboardCEO() {
  const [data, setData] = useState<CEOData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/dashboard-ceo", { cache: "no-store" });
    if (r.ok) setData(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading && !data) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (!data) return <div className="text-center text-muted-foreground p-12">Sem dados.</div>;

  const k = data.kpis;
  const origemData = Object.entries(data.leads_por_origem)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground">Visao consolidada da carteira - ultimos 30 dias</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {/* KPIs principais */}
      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard
          label="Clientes ativos" value={formatInt(k.clientes_ativos)} sub={`${k.clientes_total} totais`}
          icon={Users} color="cyan"
        />
        <KpiCard
          label="Honorario mensal" value={formatBRL(k.honorario_mensal)} sub="MRR atual"
          icon={DollarSign} color="green"
        />
        <KpiCard
          label="Verba investida (30d)" value={formatBRL(k.verba_30d)} sub={deltaLabel(k.delta_spend_pct)}
          icon={TrendingUp} color="yellow" delta={k.delta_spend_pct}
        />
        <KpiCard
          label="Leads (30d)" value={formatInt(k.leads_30d)} sub={deltaLabel(k.delta_leads_pct)}
          icon={Target} color="purple" delta={k.delta_leads_pct}
        />
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard label="CPL medio" value={formatBRL(k.cpl_medio)} icon={MousePointerClick} color="cyan" />
        <KpiCard label="CTR medio" value={formatPct(k.ctr_medio)} icon={Activity} color="green" />
        <KpiCard label="CPC medio" value={formatBRL(k.cpc_medio)} icon={MousePointerClick} color="yellow" />
        <KpiCard label="Conversoes" value={formatInt(k.conversoes_30d)} icon={Trophy} color="purple" />
      </div>

      {/* Alertas + Origem */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" /> Alertas inteligentes ({data.alerts_summary.total})
              </CardTitle>
              <div className="flex gap-2">
                {data.alerts_summary.critical > 0 && <Badge variant="destructive">{data.alerts_summary.critical} criticos</Badge>}
                {data.alerts_summary.warning > 0 && <Badge variant="warning">{data.alerts_summary.warning} avisos</Badge>}
                {data.alerts_summary.info > 0 && <Badge variant="secondary">{data.alerts_summary.info} info</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {data.alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Tudo limpo. 🎉</div>
            ) : data.alerts.slice(0, 12).map((a) => (
              <div key={a.id} className={`p-3 rounded-lg border ${a.severity === "critical" ? "border-red-500/30 bg-red-500/5" : a.severity === "warning" ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-secondary/40"}`}>
                <div className="flex items-start gap-2">
                  {a.severity === "critical" && <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />}
                  {a.severity === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />}
                  {a.severity === "info" && <Info className="h-4 w-4 text-cyan flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{a.title}</div>
                    {a.message && <div className="text-xs text-muted-foreground mt-1">{a.message}</div>}
                  </div>
                  {a.cliente_id && (
                    <Link href={`/clientes/${a.cliente_id}`}>
                      <Button size="sm" variant="ghost">Abrir</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {data.alerts.length > 12 && (
              <Link href="/alertas"><Button variant="ghost" size="sm" className="w-full">Ver todos ({data.alerts.length})</Button></Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Origem dos leads (30d)</CardTitle></CardHeader>
          <CardContent>
            {origemData.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Sem leads ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={origemData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                    {origemData.map((_, i) => <Cell key={i} fill={ORIGEM_COLORS[i % ORIGEM_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RankingCard title="🏆 Top 5 ROAS" icon={Trophy} clientes={data.rankings.melhor_roas}
          render={(c) => <span className="text-green-400 font-bold">{c.roas_estimado.toFixed(2)}x</span>} />
        <RankingCard title="📈 Mais leads" icon={Target} clientes={data.rankings.mais_leads}
          render={(c) => <span className="text-cyan font-bold">{formatInt(c.leads_30d)}</span>} />
        <RankingCard title="🎯 Melhor CTR" icon={Activity} clientes={data.rankings.melhor_ctr}
          render={(c) => <span className="text-cyan font-bold">{formatPct(c.ctr_30d)}</span>} />
        <RankingCard title="🚀 Maior crescimento" icon={TrendingUp} clientes={data.rankings.maior_crescimento}
          render={(c) => <span className="text-green-400 font-bold">+{c.delta_leads_pct.toFixed(0)}%</span>} />
        <RankingCard title="⚠️ Pior CPL (alerta)" icon={AlertTriangle} clientes={data.rankings.pior_cpl}
          render={(c) => <span className="text-red-400 font-bold">{formatBRL(c.cpl_30d)}</span>} />
      </div>

      {/* Saude da carteira (cliente x cliente) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Saude da carteira ({data.clientes.length} clientes)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Vertical</th>
                <th className="p-3 text-right">Saude</th>
                <th className="p-3 text-right">Alertas</th>
                <th className="p-3 text-right">Verba 30d</th>
                <th className="p-3 text-right">Leads 30d</th>
                <th className="p-3 text-right">CPL</th>
                <th className="p-3 text-right">Δ Leads</th>
                <th className="p-3 text-right">Posts</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.clientes.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-secondary/40">
                  <td className="p-3">
                    <Link href={`/clientes/${c.id}`} className="font-semibold hover:text-cyan">{c.nome}</Link>
                  </td>
                  <td className="p-3"><Badge variant="outline" className="text-[10px]">{c.vertical}</Badge></td>
                  <td className="p-3 text-right">
                    <HealthBadge score={c.health_score} />
                  </td>
                  <td className="p-3 text-right">
                    {c.alerts_count > 0 ? <Badge variant="warning">{c.alerts_count}</Badge> : <span className="text-muted-foreground text-xs">-</span>}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">{formatBRL(c.spend_30d)}</td>
                  <td className="p-3 text-right font-mono text-cyan">{formatInt(c.leads_30d)}</td>
                  <td className="p-3 text-right font-mono text-xs">{c.cpl_30d > 0 ? formatBRL(c.cpl_30d) : "-"}</td>
                  <td className={`p-3 text-right font-mono text-xs ${c.delta_leads_pct > 0 ? "text-green-400" : c.delta_leads_pct < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {c.delta_leads_pct === 0 ? "-" : `${c.delta_leads_pct > 0 ? "+" : ""}${c.delta_leads_pct.toFixed(0)}%`}
                  </td>
                  <td className="p-3 text-right text-xs">{c.posts_publicados}</td>
                  <td className="p-3 text-right">
                    <Link href={`/clientes/${c.id}`}><Button size="sm" variant="ghost">→</Button></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color, delta }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string; delta?: number }) {
  const colors: Record<string, string> = { cyan: "text-cyan", green: "text-green-400", yellow: "text-yellow-400", purple: "text-purple-400", red: "text-red-400" };
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className={`text-2xl font-black mt-1 ${colors[color]}`}>{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            {delta !== undefined && (delta > 0 ? <TrendingUp className="h-3 w-3 text-green-400" /> : delta < 0 ? <TrendingDown className="h-3 w-3 text-red-400" /> : null)}
            {sub}
          </div>}
        </div>
        <Icon className={`h-5 w-5 ${colors[color]}`} />
      </div>
    </CardContent></Card>
  );
}

function RankingCard({ title, icon: Icon, clientes, render }: { title: string; icon: React.ElementType; clientes: ClienteRow[]; render: (c: ClienteRow) => React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {clientes.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Sem dados ainda.</div>
        ) : clientes.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-secondary/40 rounded">
            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
            <Link href={`/clientes/${c.id}`} className="flex-1 text-sm font-semibold hover:text-cyan truncate">{c.nome}</Link>
            <div className="text-sm">{render(c)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HealthBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge variant="success">{score}</Badge>;
  if (score >= 50) return <Badge variant="warning">{score}</Badge>;
  return <Badge variant="destructive">{score}</Badge>;
}

function deltaLabel(pct: number): string {
  if (Math.abs(pct) < 0.1) return "estavel vs. periodo anterior";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs. periodo anterior`;
}
