"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Music, Download, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const TIPOS = [
  { value: "background", label: "Música de fundo (instrumental pro vídeo)" },
  { value: "abertura", label: "Abertura / jingle (10-15s)" },
  { value: "musica_completa", label: "Música completa com letra" },
];

const EXEMPLOS = [
  "trilha cinematográfica tensa com piano e strings, estilo documentário investigativo",
  "lo-fi hip hop chill pra videos de finanças, beats suaves",
  "música épica orchestral pra intro impactante de 15s",
  "dark trap beat com 808 e synths misteriosos",
  "música motivacional com guitarra acústica e batida crescente",
];

export function Trilha() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    url: string; url_variacao_2?: string; prompt_suno: string; duracao?: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    descricao: "",
    tipo: "background",
    instrumental: true,
    titulo: "",
    letra: "",
  });

  const gerar = async () => {
    if (!form.descricao.trim()) return toast.error("Descreva o tipo de música");
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/youtube/trilha", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setResult(data);
      toast.success("Música gerada", `${data.duracao ? Math.round(data.duracao) + "s" : "pronta"}`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const copyPrompt = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.prompt_suno);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Music className="h-4 w-4 text-cyan" /> Gerador de trilha sonora (Suno via PiAPI)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {TIPOS.map((t) => (
                <button key={t.value} onClick={() => setForm({ ...form, tipo: t.value, instrumental: t.value !== "musica_completa" })}
                  className={`p-3 rounded-md border text-xs font-semibold transition-colors ${form.tipo === t.value ? "border-cyan bg-cyan/10 text-cyan" : "border-border hover:border-cyan/50"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Descreva o estilo/mood em portugues</Label>
            <Textarea className="mt-1 min-h-[100px]"
              placeholder="Ex: trilha cinematográfica tensa com piano, estilo documentário investigativo"
              value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <div className="text-[10px] text-muted-foreground mt-1">
              IA traduz e otimiza o prompt automaticamente pro Suno (em inglês).
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {EXEMPLOS.map((e) => (
                <button key={e} onClick={() => setForm({ ...form, descricao: e })}
                  className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-cyan/50 text-muted-foreground">
                  {e.slice(0, 40)}...
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Título (opcional)</Label>
              <Input className="mt-1" value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.instrumental}
                  onChange={(e) => setForm({ ...form, instrumental: e.target.checked })} />
                <span className="text-sm">Instrumental (sem letra)</span>
              </label>
            </div>
          </div>

          {form.tipo === "musica_completa" && !form.instrumental && (
            <div>
              <Label>Letra (opcional — se vazio, Suno gera)</Label>
              <Textarea className="mt-1 min-h-[120px]" placeholder="Verse, chorus..."
                value={form.letra} onChange={(e) => setForm({ ...form, letra: e.target.value })} />
            </div>
          )}

          <Button onClick={gerar} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando (30-90s)...</> : <><Sparkles className="h-4 w-4" /> Gerar música</>}
          </Button>

          <div className="text-[10px] text-muted-foreground">
            Custo: ~US$ 0.10 por música gerada (PiAPI cobra por task).
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Música gerada {result.duracao && <Badge variant="secondary" className="ml-2">{Math.round(result.duracao)}s</Badge>}</CardTitle>
              <Button size="sm" variant="outline" onClick={copyPrompt}>
                {copied ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar prompt</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Variação 1</Label>
              <audio src={result.url} controls className="w-full mt-1" />
              <a href={result.url} download="trilha-v1.mp3">
                <Button size="sm" variant="outline" className="w-full mt-1"><Download className="h-3 w-3" /> Baixar v1</Button>
              </a>
            </div>

            {result.url_variacao_2 && (
              <div>
                <Label>Variação 2</Label>
                <audio src={result.url_variacao_2} controls className="w-full mt-1" />
                <a href={result.url_variacao_2} download="trilha-v2.mp3">
                  <Button size="sm" variant="outline" className="w-full mt-1"><Download className="h-3 w-3" /> Baixar v2</Button>
                </a>
              </div>
            )}

            <div>
              <Label>Prompt Suno otimizado (inglês)</Label>
              <div className="p-2 bg-background/40 border border-border rounded text-xs font-mono mt-1">
                {result.prompt_suno}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
