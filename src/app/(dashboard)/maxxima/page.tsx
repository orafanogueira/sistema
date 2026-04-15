import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { NovaOfertaMaxxima } from "@/components/maxxima/nova-oferta";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pesquisa: "secondary", validando: "warning", pronto_producao: "default",
  produzindo: "warning", pronto_campanha: "default",
  rodando: "success", pausado: "secondary", arquivado: "secondary",
};

export default async function MaxximaPage() {
  const supabase = await createClient();
  const { data: ofertas } = await supabase.from("maxxima_ofertas")
    .select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Maquina Maxxima</h1>
          <p className="text-muted-foreground">Pipeline info-produto: mineira -&gt; valida -&gt; produz -&gt; campanha.</p>
        </div>
        <NovaOfertaMaxxima />
      </div>

      <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
        <CardContent className="p-5 text-sm">
          <div className="font-bold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan" /> Pipeline Maxxima</div>
          <div className="text-muted-foreground grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>🔍 <b>Pesquisa</b><br/>Mineira ofertas ativas &gt;7d na Meta Library</div>
            <div>✅ <b>Valida</b><br/>Google Trends + concorrencia + volume</div>
            <div>📝 <b>Produz</b><br/>Ebook IA + carrossel SVG + roteiro reel</div>
            <div>🚀 <b>Sobe campanha</b><br/>Estrutura seguindo metodologia Maxxima</div>
            <div>📊 <b>Otimiza</b><br/>Pausa criativos ruins, escala vencedores</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Total ofertas</div>
          <div className="text-2xl font-black mt-1">{ofertas?.length || 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Validadas</div>
          <div className="text-2xl font-black mt-1 text-green-400">{(ofertas || []).filter((o) => o.validado).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Rodando</div>
          <div className="text-2xl font-black mt-1 text-cyan">{(ofertas || []).filter((o) => o.status === "rodando").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Score medio</div>
          <div className="text-2xl font-black mt-1 text-purple-400">
            {ofertas?.length ? Math.round((ofertas.reduce((s, o) => s + (o.score_viabilidade || 0), 0) / ofertas.length)) : 0}
          </div>
        </CardContent></Card>
      </div>

      {!ofertas?.length ? (
        <Card><CardContent className="p-12 text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold mb-1">Nenhuma oferta na maquina</div>
          <div className="text-sm text-muted-foreground">Adicione uma oferta pra iniciar o pipeline.</div>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {ofertas.map((o) => (
            <Card key={o.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{o.nome}</CardTitle>
                  <Badge variant={STATUS_COLORS[o.status] || "secondary"}>{o.status.replace(/_/g, " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">Nicho: {o.nicho || "-"}</div>
                {o.promessa && <div className="text-xs italic">&quot;{o.promessa}&quot;</div>}
                <div className="flex gap-3 text-xs">
                  {o.preco && <span>💰 {formatBRL(Number(o.preco))}</span>}
                  {o.anuncios_ativos_dias && <span>📅 {o.anuncios_ativos_dias}d ativo</span>}
                  <span className="ml-auto">Score: <b className={o.score_viabilidade >= 70 ? "text-green-400" : o.score_viabilidade >= 50 ? "text-yellow-400" : "text-red-400"}>{o.score_viabilidade || 0}/100</b></span>
                </div>
                <Link href={`/maxxima/${o.id}`}><Button variant="outline" size="sm" className="w-full mt-2">Abrir pipeline</Button></Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
