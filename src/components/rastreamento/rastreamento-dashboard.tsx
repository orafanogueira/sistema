"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatInt, formatPct } from "@/lib/utils";
import { Loader2, RefreshCw, MessageSquare, TrendingUp, DollarSign, Target, Link2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

interface ResData {
  totals: {
    conversas_ativas: number; rastreadas: number; taxa_rastreio: number;
    vendas: number; faturamento: number; taxa_conversao: number;
    cliques_em_links: number; sessions_unicas_site: number;
  };
  por_origem: Record<string, number>;
  conversas_por_dia: { date: string; count: number }[];
  top_campanhas: { name: string; count: number }[];
  pixel: { enviados: number; falhados: number; pendentes: number };
}

const COLORS = ["#0055cc","#00c8e0","#22c55e","#f59e0b","#a855f7","#ec4899","#ef4444","#06b6d4"];

export function RastreamentoDashboard() {
  const [data, setData] = useState<ResData | null>(null);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [cliente, setCliente] = useState<string>("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("days", String(days));
    if (cliente) qs.set("cliente_id", cliente);
    const r = await fetch(`/api/rastreamento/dashboard?${qs.toString()}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then((c) => setClientes(Array.isArray(c) ? c : []));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cliente, days]);

  const origemData = data
    ? Object.entries(data.por_origem).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Rastreamento</h1>
          <p className="text-muted-foreground">Conversas rastreadas, origem, funil e faturamento.</p>
        </div>
        <div className="flex gap-2">
          <select className="h-10 rounded-md border border-input bg-background/40 px-3 text-sm"
            value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Todos os clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d}d</Button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!data ? (
        <Card><CardContent className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <Kpi label="Conversas ativas" value={formatInt(data.totals.conversas_ativas)} icon={MessageSquare} color="text-cyan" />
            <Kpi label="Rastreadas" value={formatInt(data.totals.rastreadas)} sub={`${formatPct(data.totals.taxa_rastreio)} do total`} icon={Target} color="text-green-400" />
            <Kpi label="Vendas" value={formatInt(data.totals.vendas)} sub={`${formatPct(data.totals.taxa_conversao)} conversao`} icon={TrendingUp} color="text-purple-400" />
            <Kpi label="Faturamento" value={formatBRL(data.totals.faturamento)} icon={DollarSign} color="text-yellow-400" />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Kpi label="Cliques em links rastreaveis" value={formatInt(data.totals.cliques_em_links)} icon={Link2} color="text-cyan" />
            <Kpi label="Sessoes no site (pageview)" value={formatInt(data.totals.sessions_unicas_site)} icon={MessageSquare} color="text-green-400" />
            <Kpi label="Eventos pixel enviados" value={formatInt(data.pixel.enviados)} sub={`${data.pixel.pendentes} pendentes · ${data.pixel.falhados} falharam`} icon={Target} color="text-purple-400" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Conversas por dia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.conversas_por_dia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="count" stroke="#00c8e0" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Origem das conversas</CardTitle></CardHeader>
              <CardContent>
                {origemData.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Sem conversas no periodo.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={origemData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                        {origemData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Top campanhas / origens detalhadas</CardTitle></CardHeader>
            <CardContent>
              {data.top_campanhas.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Sem dados.</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.top_campanhas} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                    <XAxis type="number" stroke="#64748b" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={180} />
                    <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#0055cc" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className={`text-2xl font-black mt-1 ${color}`}>{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
    </CardContent></Card>
  );
}
