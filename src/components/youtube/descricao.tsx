"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Copy, Check, FileText } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function Descricao() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ descricao: string; tags: string; tags_chars: number } | null>(null);
  const [copied, setCopied] = useState<"desc" | "tags" | null>(null);
  const [form, setForm] = useState({ titulo: "", tema: "" });
  const [links, setLinks] = useState<{ nome: string; url: string }[]>([{ nome: "", url: "" }]);

  const addLink = () => setLinks([...links, { nome: "", url: "" }]);
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));
  const setLink = (i: number, k: "nome" | "url", v: string) =>
    setLinks(links.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const gerar = async () => {
    if (!form.titulo.trim()) return toast.error("Informe o titulo");
    setLoading(true);
    setResultado(null);
    try {
      const r = await fetch("/api/youtube/descricao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, links: links.filter((l) => l.url.trim()) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setResultado(data);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const copyIt = (txt: string, k: "desc" | "tags") => {
    navigator.clipboard.writeText(txt);
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Gerador de descricao + tags SEO</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Titulo do video</Label>
            <Input className="mt-1" value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Tema / contexto (opcional)</Label>
            <Textarea className="mt-1" value={form.tema}
              onChange={(e) => setForm({ ...form, tema: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Links do video</Label>
              <Button size="sm" variant="outline" onClick={addLink}><Plus className="h-3 w-3" /> Link</Button>
            </div>
            <div className="space-y-2 mt-1">
              {links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Nome (ex: Aulão 3h)" value={l.nome}
                    onChange={(e) => setLink(i, "nome", e.target.value)} />
                  <Input placeholder="https://bit.ly/..." value={l.url}
                    onChange={(e) => setLink(i, "url", e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => removeLink(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={gerar} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4" /> Gerar descricao + tags</>}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Descricao</CardTitle>
                <Button size="sm" variant="outline" onClick={() => copyIt(resultado.descricao, "desc")}>
                  {copied === "desc" ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-background/40 border border-border rounded whitespace-pre-wrap text-sm max-h-[400px] overflow-y-auto">
                {resultado.descricao}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tags ({resultado.tags_chars}/500 chars)</CardTitle>
                <Button size="sm" variant="outline" onClick={() => copyIt(resultado.tags, "tags")}>
                  {copied === "tags" ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-background/40 border border-border rounded text-xs font-mono max-h-[200px] overflow-y-auto">
                {resultado.tags}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
