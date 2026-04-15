"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loader2, Sparkles, Download } from "lucide-react";

export function CarrosselGenerator() {
  const [form, setForm] = useState({
    tema: "Como escolher carro usado seguro",
    objetivo: "educacional",
    slides: 7,
    publico: "Compradores de primeiro carro, 25-40 anos",
    cor_primaria: "#0055cc",
    cor_secundaria: "#00c8e0",
    marca: "Grupo Nogueira",
  });
  const [loading, setLoading] = useState(false);
  const [svgs, setSvgs] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null); setSvgs([]);
    try {
      const r = await fetch("/api/criativos/carrossel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setSvgs(data.svgs || []);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  const download = (svg: string, i: number) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carrossel-slide-${i + 1}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-1 h-fit">
        <CardHeader><CardTitle className="text-sm">Parametros</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={generate} className="space-y-3">
            <div><Label>Tema *</Label><Input required value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} /></div>
            <div><Label>Objetivo</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })}>
                <option value="educacional">Educacional</option>
                <option value="venda">Venda</option>
                <option value="autoridade">Autoridade</option>
              </select>
            </div>
            <div><Label>Slides</Label><Input type="number" min="3" max="10" value={form.slides}
              onChange={(e) => setForm({ ...form, slides: Number(e.target.value) })} /></div>
            <div><Label>Publico</Label><Input value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cor primaria</Label><Input type="color" className="h-10 p-1"
                value={form.cor_primaria} onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })} /></div>
              <div><Label>Cor secundaria</Label><Input type="color" className="h-10 p-1"
                value={form.cor_secundaria} onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })} /></div>
            </div>
            <div><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4" /> Gerar carrossel</>}
            </Button>
          </form>
          {err && <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">{err}</div>}
        </CardContent>
      </Card>

      <div className="md:col-span-2 space-y-3">
        {svgs.length === 0 && !loading && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            Preencha os parametros e clique em Gerar pra ver os slides.
          </CardContent></Card>
        )}
        {svgs.map((svg, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold">Slide {i + 1}</div>
                <Button size="sm" variant="outline" onClick={() => download(svg, i)}>
                  <Download className="h-3 w-3" /> Baixar SVG
                </Button>
              </div>
              <div className="bg-secondary/40 rounded overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
