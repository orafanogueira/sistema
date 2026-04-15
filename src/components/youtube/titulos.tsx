"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface TituloOpt { titulo: string; score_seo: number; analise: string }

export function Titulos() {
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [items, setItems] = useState<TituloOpt[]>([]);
  const [form, setForm] = useState({ tema: "", titulo_referencia: "", estilo: "canal dark storytelling" });

  const gerar = async () => {
    if (!form.tema.trim() && !form.titulo_referencia.trim()) return toast.error("Informe um tema OU titulo de referencia");
    setLoading(true);
    setItems([]);
    try {
      const r = await fetch("/api/youtube/titulos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setItems(data.titulos || []);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const copy = (txt: string, i: number) => {
    navigator.clipboard.writeText(txt);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Gerador de titulos magneticos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Tema do video</Label>
            <Input className="mt-1" placeholder="Ex: homem ganhava 1700 virou 40k com canal dark"
              value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} />
          </div>
          <div>
            <Label>Titulo de referencia (opcional — pra reestruturar)</Label>
            <Textarea className="mt-1"
              placeholder="Cole aqui o titulo de um concorrente que voce quer adaptar. IA muda estrutura pra fugir de copia."
              value={form.titulo_referencia} onChange={(e) => setForm({ ...form, titulo_referencia: e.target.value })} />
          </div>
          <div>
            <Label>Estilo</Label>
            <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
              value={form.estilo} onChange={(e) => setForm({ ...form, estilo: e.target.value })}>
              <option value="canal dark storytelling">Canal dark / storytelling</option>
              <option value="curiosidade alta revelacao">Curiosidade + revelacao</option>
              <option value="numero + beneficio">Numero + beneficio</option>
              <option value="contraste antes depois">Contraste antes/depois</option>
              <option value="pergunta provocativa">Pergunta provocativa</option>
            </select>
          </div>
          <Button onClick={gerar} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Gerar 10 variacoes</>}
          </Button>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.sort((a, b) => b.score_seo - a.score_seo).map((t, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex items-start gap-3">
                <Badge variant={t.score_seo >= 85 ? "success" : t.score_seo >= 70 ? "warning" : "secondary"} className="text-[11px] flex-shrink-0">
                  {t.score_seo}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{t.titulo}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{t.analise}</div>
                  <div className="text-[10px] text-muted-foreground">{t.titulo.length} chars</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => copy(t.titulo, i)}>
                  {copiedIdx === i ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
