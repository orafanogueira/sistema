"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Music, Download, Sparkles, Copy, Check, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const TIPOS = [
  { value: "background", label: "Música de fundo" },
  { value: "abertura", label: "Abertura / jingle" },
  { value: "musica_completa", label: "Música completa com letra" },
];

const ESTILOS = [
  "cinematic dark", "cinematic epic", "lo-fi hip hop", "trap brasileiro", "trap dark",
  "sertanejo emocional", "pop motivacional", "ambient piano", "orchestral epic",
  "edm electronic", "rock alternativo", "indie folk", "synthwave", "country acoustic",
  "rap consciente", "funk brasileiro", "bossa nova", "samba", "reggaeton",
  "house tropical", "drill", "phonk", "retro 80s", "jazz noir",
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
  const [letraLoading, setLetraLoading] = useState(false);
  const [result, setResult] = useState<{
    url: string; url_variacao_2?: string; prompt_suno: string; duracao?: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    descricao: "",
    tipo: "background",
    instrumental: true,
    estilo: "cinematic dark",
    titulo: "",
    letra: "",
    tema_letra: "",
    idioma_letra: "portugues brasileiro",
  });

  const gerarLetra = async () => {
    if (!form.tema_letra.trim()) return toast.error("Descreva o tema da letra");
    setLetraLoading(true);
    try {
      const r = await fetch("/api/youtube/letra-musica", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: form.tema_letra, estilo: form.estilo, idioma: form.idioma_letra }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setForm((f) => ({ ...f, letra: data.letra, instrumental: false }));
      toast.success("Letra gerada");
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setLetraLoading(false); }
  };

  const gerar = async () => {
    if (!form.descricao.trim()) return toast.error("Descreva o estilo/mood");
    setLoading(true);
    setResult(null);
    try {
      const descCompleta = `${form.descricao}${form.estilo ? ` - estilo ${form.estilo}` : ""}`;
      const r = await fetch("/api/youtube/trilha", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, descricao: descCompleta }),
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
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Music className="h-4 w-4 text-cyan" /> Gerador de trilha sonora (Suno via SunoAPI.com)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Tipo de música</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {TIPOS.map((t) => (
                <button key={t.value} onClick={() => setForm({ ...form, tipo: t.value, instrumental: t.value !== "musica_completa" })}
                  className={`p-3 rounded-md border text-xs font-semibold transition-colors ${form.tipo === t.value ? "border-cyan bg-cyan/10 text-cyan" : "border-border hover:border-cyan/50"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estilo musical</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.estilo} onChange={(e) => setForm({ ...form, estilo: e.target.value })}>
                {ESTILOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <Label>Título (opcional)</Label>
              <Input className="mt-1" value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Descricao do mood (em portugues, IA traduz)</Label>
            <Textarea className="mt-1 min-h-[80px]"
              placeholder="Ex: trilha tensa com piano e strings, documentário investigativo"
              value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <div className="flex flex-wrap gap-1 mt-2">
              {EXEMPLOS.map((e) => (
                <button key={e} onClick={() => setForm({ ...form, descricao: e })}
                  className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-cyan/50 text-muted-foreground">
                  {e.slice(0, 35)}...
                </button>
              ))}
            </div>
          </div>

          {form.tipo === "musica_completa" && (
            <div className="space-y-2 p-3 border border-cyan/30 bg-cyan/5 rounded">
              <div className="flex items-center justify-between">
                <Label>Letra (roteiro da musica)</Label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.instrumental}
                    onChange={(e) => setForm({ ...form, instrumental: e.target.checked, letra: e.target.checked ? "" : form.letra })} />
                  Sem letra (instrumental)
                </label>
              </div>

              {!form.instrumental && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Tema da letra (ex: superação, amor, motivação)"
                      value={form.tema_letra} onChange={(e) => setForm({ ...form, tema_letra: e.target.value })} />
                    <select className="flex h-10 rounded-md border border-input bg-background/40 px-3 text-sm"
                      value={form.idioma_letra} onChange={(e) => setForm({ ...form, idioma_letra: e.target.value })}>
                      <option value="portugues brasileiro">Português BR</option>
                      <option value="english">Inglês</option>
                      <option value="español">Espanhol</option>
                    </select>
                  </div>
                  <Button size="sm" variant="outline" onClick={gerarLetra} disabled={letraLoading} className="w-full">
                    {letraLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Gerando letra...</> : <><Wand2 className="h-3 w-3" /> Gerar letra com IA</>}
                  </Button>

                  <Textarea className="min-h-[180px] font-mono text-xs"
                    placeholder="[Verse 1]&#10;...&#10;[Chorus]&#10;...&#10;ou clique 'Gerar letra com IA'"
                    value={form.letra} onChange={(e) => setForm({ ...form, letra: e.target.value })} />
                  <div className="text-[10px] text-muted-foreground">
                    Use tags [Verse 1], [Chorus], [Bridge] pra Suno entender a estrutura.
                  </div>
                </>
              )}
            </div>
          )}

          <Button onClick={gerar} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando (30-90s)...</> : <><Sparkles className="h-4 w-4" /> Gerar música</>}
          </Button>

          <div className="text-[10px] text-muted-foreground">
            Custo: ~US$ 0.10 por geração (2 variações).
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
              <Label>Prompt Suno (inglês)</Label>
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
