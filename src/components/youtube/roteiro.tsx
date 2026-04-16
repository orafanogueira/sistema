"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, Copy, Check, Video } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const STORAGE = "yt-roteiro-v1";

export function Roteiro() {
  const saved = typeof window !== "undefined" ? (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return {}; }
  })() : {};
  const [loading, setLoading] = useState(false);
  const [roteiro, setRoteiro] = useState<string>(saved.roteiro || "");
  const [copied, setCopied] = useState(false);
  const [meta, setMeta] = useState<{ duracao_min: number; hooks_esperados: number } | null>(saved.meta || null);
  const [form, setForm] = useState(saved.form || {
    titulo: "",
    duracao_min: 10,
    tema: "",
    cta_final: "",
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify({ roteiro, meta, form })); } catch {}
  }, [roteiro, meta, form]);

  const gerar = async () => {
    if (!form.titulo.trim()) return toast.error("Informe o titulo");
    setLoading(true);
    setRoteiro("");
    try {
      const r = await fetch("/api/youtube/roteiro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setRoteiro(data.roteiro);
      setMeta({ duracao_min: data.duracao_min, hooks_esperados: data.hooks_esperados });
      toast.success(`Roteiro gerado`, `${data.hooks_esperados} hooks distribuidos em ${data.duracao_min}min`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(roteiro);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Gerador de roteiro magnetico (Dotti-style)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Titulo do video</Label>
            <Input className="mt-1" placeholder="Ex: Como sai de R$1700 pra R$40k com canal dark"
              value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Duracao alvo (min)</Label>
              <Input type="number" min={3} max={60} className="mt-1" value={form.duracao_min}
                onChange={(e) => setForm({ ...form, duracao_min: Number(e.target.value) })} />
              <div className="text-[10px] text-muted-foreground mt-1">
                {form.duracao_min >= 15 ? "6 hooks de engajamento" : "2 hooks de engajamento"}
              </div>
            </div>
            <div>
              <Label>CTA final desejado</Label>
              <Input className="mt-1" placeholder="Ex: inscricao + proximo video"
                value={form.cta_final} onChange={(e) => setForm({ ...form, cta_final: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Tema / contexto</Label>
            <Textarea className="mt-1 min-h-[100px]"
              placeholder="Qual a historia? Personagens? Virada? O que o video entrega?"
              value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} />
          </div>

          <Button onClick={gerar} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Escrevendo roteiro...</> : <><Video className="h-4 w-4" /> Gerar roteiro magnetico</>}
          </Button>
        </CardContent>
      </Card>

      {roteiro && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Roteiro {meta && `(${meta.duracao_min}min, ${meta.hooks_esperados} hooks)`}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-background/40 border border-border rounded whitespace-pre-wrap text-sm max-h-[600px] overflow-y-auto">
              {roteiro}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
