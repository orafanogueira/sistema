"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatInt, formatDate } from "@/lib/utils";
import { Loader2, TrendingUp, DollarSign, AlertCircle, Calendar, RefreshCw } from "lucide-react";

interface Data {
  kpis: {
    mrr: number; arr: number; receita_30d: number; previsao_30d: number;
    inadimplencia: number; total_cobrancas: number; pagas_30d: number;
    pendentes: number; vencidas: number; assinaturas_ativas: number;
  };
  top_clientes: { nome: string; mrr: number; cliente_id: string }[];
  inadimplentes: { nome: string; cliente_id: string; total: number; qtd: number }[];
  ultimas_cobrancas: { id: string; descricao: string | null; valor: number; status: string; due_date: string; paid_at: string | null; forma_pagamento: string; cliente: { nome?: string } | null }[];
}

export function FinanceiroDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/financeiro/dashboard");
    if (r.ok) setData(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (!data) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">MRR, receita, inadimplencia e previsao proximos 30 dias.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Link href="/cobrancas"><Button>Nova cobranca</Button></Link>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Kpi label="MRR" value={formatBRL(k.mrr)} sub={`ARR: ${formatBRL(k.arr)}`} icon={TrendingUp} color="text-green-400" />
        <Kpi label="Recebido (30d)" value={formatBRL(k.receita_30d)} sub={`${k.pagas_30d} pagamentos`} icon={DollarSign} color="text-cyan" />
        <Kpi label="Previsao (30d)" value={formatBRL(k.previsao_30d)} sub={`${k.pendentes} pendentes`} icon={Calendar} color="text-yellow-400" />
        <Kpi label="Inadimplencia" value={formatBRL(k.inadimplencia)} sub={`${k.vencidas} vencidas`} icon={AlertCircle} color="text-red-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">🏆 Top clientes por MRR</CardTitle></CardHeader>
          <CardContent>
            {data.top_clientes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma assinatura ativa ainda.</div>
            ) : (
              <div className="space-y-2">
                {data.top_clientes.map((c, i) => (
                  <div key={c.cliente_id} className="flex items-center gap-3 p-2 hover:bg-secondary/40 rounded">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <Link href={`/clientes/${c.cliente_id}`} className="flex-1 text-sm font-semibold hover:text-cyan">{c.nome}</Link>
                    <span className="text-sm font-bold text-green-400">{formatBRL(c.mrr)}/mes</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm text-red-400 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Inadimplentes</CardTitle></CardHeader>
          <CardContent>
            {data.inadimplentes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">🎉 Ninguem inadimplente!</div>
            ) : (
              <div className="space-y-2">
                {data.inadimplentes.map((c) => (
                  <div key={c.cliente_id} className="flex items-center gap-3 p-2 hover:bg-secondary/40 rounded">
                    <Link href={`/clientes/${c.cliente_id}`} className="flex-1 text-sm font-semibold hover:text-cyan">{c.nome}</Link>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-400">{formatBRL(c.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{c.qtd} cobranca(s)</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Ultimas cobrancas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.ultimas_cobrancas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Nenhuma cobranca registrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr><th className="p-3 text-left">Descricao</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-right">Valor</th><th className="p-3 text-left">Vencimento</th><th className="p-3 text-left">Status</th></tr>
              </thead>
              <tbody>
                {data.ultimas_cobrancas.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="p-3">{c.descricao || "-"}</td>
                    <td className="p-3 text-muted-foreground">{c.cliente?.nome || "-"}</td>
                    <td className="p-3 text-right font-mono">{formatBRL(Number(c.valor))}</td>
                    <td className="p-3 text-xs">{formatDate(c.due_date)}</td>
                    <td className="p-3">
                      <Badge variant={c.status === "paga" ? "success" : c.status === "vencida" ? "destructive" : "warning"}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
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
