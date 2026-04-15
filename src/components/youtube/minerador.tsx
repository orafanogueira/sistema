"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Target, ExternalLink, TrendingUp } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Canal {
  channel_id: string; channel_name: string; channel_url: string;
  inscritos: number; total_videos: number; total_views: number;
  media_views_ultimos_30d: number; ctr_estimado: number;
  score_oportunidade: number;
  trends_google_score: number; trends_youtube_score: number; trends_gap: number;
  thumbnail_url: string | null;
}

const CATEGORIAS = [
  "historias emocionantes", "canal dark financas", "curiosidades", "misterios",
  "relacionamentos", "vida pessoal", "motivacional", "noticias surreais",
  "historias reais", "conspiracao", "sobrevivencia", "relatos",
  "historias de terror", "casos reais policiais",
];

export function Minerador() {
  const [loading, setLoading] = useState(false);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [trends, setTrends] = useState<{ google: number; youtube: number; gap: number } | null>(null);
  const [form, setForm] = useState({
    categoria: "", pais: "BR", min_inscritos: 1000, max_inscritos: 100000, max_videos: 50,
  });

  const minerar = async () => {
    if (!form.categoria.trim()) return toast.error("Informe uma categoria");
    setLoading(true);
    setCanais([]);
    setTrends(null);
    try {
      const r = await fetch("/api/youtube/minerador", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setCanais(data.canais || []);
      setTrends(data.trends);
      toast.success(`${data.canais?.length || 0} oportunidades encontradas`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Parametros de mineracao</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Categoria / nicho</Label>
            <Input className="mt-1" list="cats-yt"
              placeholder="Ex: historias emocionantes, canal dark financas"
              value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            <datalist id="cats-yt">
              {CATEGORIAS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Pais</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })}>
                <option value="BR">🇧🇷 Brasil</option>
                <option value="US">🇺🇸 EUA</option>
                <option value="PT">🇵🇹 Portugal</option>
                <option value="MX">🇲🇽 Mexico</option>
                <option value="ES">🇪🇸 Espanha</option>
              </select>
            </div>
            <div>
              <Label>Min inscritos</Label>
              <Input type="number" className="mt-1" value={form.min_inscritos}
                onChange={(e) => setForm({ ...form, min_inscritos: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Max inscritos</Label>
              <Input type="number" className="mt-1" value={form.max_inscritos}
                onChange={(e) => setForm({ ...form, max_inscritos: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Max videos</Label>
              <Input type="number" className="mt-1" value={form.max_videos}
                onChange={(e) => setForm({ ...form, max_videos: Number(e.target.value) })} />
            </div>
          </div>

          <Button onClick={minerar} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Minerando (ate 2 min)...</> : <><Target className="h-4 w-4" /> Minerar canais</>}
          </Button>
        </CardContent>
      </Card>

      {trends && (
        <Card className="border-cyan/30 bg-cyan/5">
          <CardContent className="p-4 flex items-center gap-4 text-sm">
            <TrendingUp className="h-5 w-5 text-cyan" />
            <div className="flex-1">
              <div className="font-bold">Google Trends (ultimos 90 dias)</div>
              <div className="text-xs text-muted-foreground">
                Google: <b className="text-foreground">{trends.google}</b> ·
                YouTube: <b className="text-foreground">{trends.youtube}</b> ·
                Gap: <b className={trends.gap > 20 ? "text-green-400" : trends.gap > 0 ? "text-yellow-400" : "text-muted-foreground"}>{trends.gap}</b>
                {trends.gap > 20 && " 🔥 (alta oportunidade — muita busca Google, pouca oferta YouTube)"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canais.length > 0 && (
        <div className="space-y-2">
          {canais.map((c) => (
            <Card key={c.channel_id}>
              <CardContent className="p-4 flex items-start gap-3">
                {c.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail_url} alt="" className="w-16 h-16 rounded-full flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-bold">{c.channel_name}</div>
                    <Badge variant={c.score_oportunidade > 70 ? "success" : c.score_oportunidade > 40 ? "warning" : "secondary"}>
                      Score {c.score_oportunidade}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-3">
                    <span>👥 {c.inscritos.toLocaleString("pt-BR")} insc.</span>
                    <span>🎬 {c.total_videos} videos</span>
                    <span>👁 {c.media_views_ultimos_30d.toLocaleString("pt-BR")} media</span>
                    <span>📊 CTR {c.ctr_estimado}%</span>
                  </div>
                </div>
                <a href={c.channel_url} target="_blank" rel="noopener">
                  <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3" /> Abrir</Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
