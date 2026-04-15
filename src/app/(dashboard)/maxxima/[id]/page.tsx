import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Sparkles } from "lucide-react";
import { GerarEbookButton } from "@/components/maxxima/gerar-ebook-button";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OfertaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: o } = await supabase.from("maxxima_ofertas").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();

  let validacao: { score: number; veredito: string; sinais_positivos: string[]; sinais_negativos: string[]; acoes_sugeridas: string[] } | null = null;
  try { validacao = o.viabilidade_notes ? JSON.parse(o.viabilidade_notes) : null; } catch { /* ignora */ }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/maxxima"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black">{o.nome}</h1>
            <Badge>{o.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{o.nicho} · Score: <b>{o.score_viabilidade || 0}/100</b></p>
        </div>
      </div>

      {validacao && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-green-500/30">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-green-400"><Check className="h-4 w-4" /> Sinais positivos</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {validacao.sinais_positivos.length === 0 ? (
                <div className="text-muted-foreground">-</div>
              ) : validacao.sinais_positivos.map((s, i) => <div key={i}>• {s}</div>)}
            </CardContent>
          </Card>
          <Card className="border-red-500/30">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-red-400"><X className="h-4 w-4" /> Sinais negativos</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {validacao.sinais_negativos.length === 0 ? (
                <div className="text-muted-foreground">Nenhum</div>
              ) : validacao.sinais_negativos.map((s, i) => <div key={i}>• {s}</div>)}
            </CardContent>
          </Card>
        </div>
      )}

      {validacao?.acoes_sugeridas && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan" /> Proximas acoes</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {validacao.acoes_sugeridas.map((a, i) => <div key={i}>→ {a}</div>)}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Oferta</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Publico:</span> {o.publico_alvo || "-"}</div>
            <div><span className="text-muted-foreground">Dor:</span> {o.dor_principal || "-"}</div>
            <div><span className="text-muted-foreground">Promessa:</span> {o.promessa || "-"}</div>
            <div><span className="text-muted-foreground">Preco:</span> {o.preco ? formatBRL(Number(o.preco)) : "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Mineira</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Anuncios ativos:</span> {o.anuncios_ativos_dias || "?"} dias</div>
            <div><span className="text-muted-foreground">Google Trends:</span> {o.google_trends_score || "?"}/100</div>
            <div><span className="text-muted-foreground">Volume busca:</span> {o.volume_busca?.toLocaleString("pt-BR") || "?"}/mes</div>
            <div><span className="text-muted-foreground">Concorrentes:</span> {(o.concorrentes || []).length}</div>
          </CardContent>
        </Card>
      </div>

      {o.status === "pronto_producao" && (
        <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
          <CardHeader><CardTitle className="text-sm">Producao — proximo passo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Oferta validada! Agora voce pode gerar conteudo automaticamente:
            </div>
            <div className="flex gap-2">
              <GerarEbookButton ofertaId={o.id} oferta={o} />
              <Link href={`/criativos?tema=${encodeURIComponent(o.nome)}&objetivo=venda`}>
                <Button variant="outline"><Sparkles className="h-4 w-4" /> Gerar carrossel</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
