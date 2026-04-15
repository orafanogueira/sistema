import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatInt, formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Data {
  cliente: { nome: string; vertical: string } | null;
  config: { show_meta_ads: boolean; show_google_ads: boolean; show_leads: boolean; show_financeiro: boolean; show_social: boolean };
  periodo: string;
  metrics: { date: string; spend: number; clicks: number; impressions: number; leads: number; provider: string }[];
  leads: { id: string; status: string; origem: string }[];
  posts: { id: string; format: string }[];
}

export default async function DashboardPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://app.gruponogueiramkt.com";
  const res = await fetch(`${url}/api/dashboard-publico/${token}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const data = (await res.json()) as Data;

  const totalSpend = data.metrics.reduce((s, m) => s + Number(m.spend || 0), 0);
  const totalClicks = data.metrics.reduce((s, m) => s + Number(m.clicks || 0), 0);
  const totalLeads = data.metrics.reduce((s, m) => s + Number(m.leads || 0), 0);
  const totalImp = data.metrics.reduce((s, m) => s + Number(m.impressions || 0), 0);
  const leadsQualificados = data.leads.filter((l) => l.status === "ganho").length;
  const taxaConv = data.leads.length > 0 ? (leadsQualificados / data.leads.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">{data.cliente?.nome}</h1>
            <p className="text-muted-foreground">{data.periodo}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Dashboard compartilhado<br />Grupo Nogueira
          </div>
        </div>

        {(data.config.show_meta_ads || data.config.show_google_ads) && (
          <>
            <h2 className="text-xl font-bold">Trafego pago</h2>
            <div className="grid md:grid-cols-4 gap-4">
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Investimento</div>
                <div className="text-2xl font-black mt-1 text-yellow-400">{formatBRL(totalSpend)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Impressoes</div>
                <div className="text-2xl font-black mt-1">{formatInt(totalImp)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Cliques</div>
                <div className="text-2xl font-black mt-1 text-cyan">{formatInt(totalClicks)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Leads gerados</div>
                <div className="text-2xl font-black mt-1 text-green-400">{formatInt(totalLeads)}</div>
              </CardContent></Card>
            </div>
          </>
        )}

        {data.config.show_leads && (
          <>
            <h2 className="text-xl font-bold">Comercial</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Total de leads</div>
                <div className="text-2xl font-black mt-1">{data.leads.length}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Fechados</div>
                <div className="text-2xl font-black mt-1 text-green-400">{leadsQualificados}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Taxa de conversao</div>
                <div className="text-2xl font-black mt-1 text-cyan">{formatPct(taxaConv)}</div>
              </CardContent></Card>
            </div>
          </>
        )}

        {data.config.show_social && (
          <>
            <h2 className="text-xl font-bold">Social Media</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardContent className="p-5">
                <div className="text-xs text-muted-foreground uppercase">Posts publicados</div>
                <div className="text-2xl font-black mt-1 text-purple-400">{data.posts.length}</div>
              </CardContent></Card>
            </div>
          </>
        )}

        <div className="text-center pt-8 text-[11px] text-muted-foreground">
          Dashboard gerado por Grupo Nogueira OS · atualiza automaticamente
        </div>
      </div>
    </div>
  );
}
