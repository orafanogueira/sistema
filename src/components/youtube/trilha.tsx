"use client";
import { useEffect, useState } from "react";
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

// Suno gera tipicamente entre 30s e 4min. Esse valor entra como sugestao no prompt.
const DURACOES_SUGERIDAS = [
  { value: 15, label: "15s (jingle/abertura)" },
  { value: 30, label: "30s (intro curta)" },
  { value: 60, label: "60s (1 minuto)" },
  { value: 90, label: "90s (1m30s)" },
  { value: 120, label: "2 minutos" },
  { value: 180, label: "3 minutos" },
  { value: 240, label: "4 minutos" },
];

const EXEMPLOS = [
  "trilha cinematográfica tensa com piano e strings, estilo documentário investigativo",
  "lo-fi hip hop chill pra videos de finanças, beats suaves",
  "música épica orchestral pra intro impactante de 15s",
  "dark trap beat com 808 e synths misteriosos",
  "música motivacional com guitarra acústica e batida crescente",
];

interface TrilhaHist {
  id: string; tipo: string; prompt_descricao: string; titulo_variacao?: string;
  duracao_sec?: number; url: string; url_variacao_2?: string; created_at: string;
}

export function Trilha() {
  const [loading, setLoading] = useState(false);
  const [letraLoading, setLetraLoading] = useState(false);
  const [result, setResult] = useState<{
    url: string; url_variacao_2?: string; prompt_suno: string; duracao?: number;
  } | null>(null);
  const [resultDebug, setResultDebug] = useState("");
  const [historico, setHistorico] = useState<TrilhaHist[]>([]);
  const [copied, setCopied] = useState(false);

  const loadHistorico = async () => {
    try {
      const r = await fetch("/api/youtube/trilha");
      if (!r.ok) return;
      const data = await r.json();
      setHistorico(data || []);
    } catch {}
  };

  useEffect(() => { loadHistorico(); }, []);
  const [form, setForm] = useState({
    descricao: "",
    tipo: "background",
    instrumental: true,
    duracao_seg: 60,
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
        body: JSON.stringify({ tema: form.tema_letra, estilo: form.descricao, idioma: form.idioma_letra }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setForm((f) => ({ ...f, letra: data.letra, instrumental: false }));
      toast.success("Letra gerada");
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setLetraLoading(false); }
  };

  const pollStatus = async (trilhaId: string) => {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      setResultDebug(`Polling ${i + 1}/90... (~${(i + 1) * 5}s)`);
      try {
        const r = await fetch(`/api/youtube/trilha/status?id=${trilhaId}`);
        if (!r.ok) continue;
        const data = await r.json();
        if (data.status === "complete" && data.trilha?.url) {
          setResult({
            url: data.trilha.url,
            url_variacao_2: data.trilha.url_variacao_2,
            prompt_suno: data.trilha.prompt_suno || "",
            duracao: data.trilha.duracao_sec,
          });
          setResultDebug(`PRONTO: ${data.trilha.url.slice(0, 60)}...`);
          toast.success("Música pronta! Veja abaixo.");
          loadHistorico();
          setTimeout(() => document.getElementById("trilha-resultado")?.scrollIntoView({ behavior: "smooth" }), 300);
          return;
        }
        if (data.status === "error") {
          setResultDebug(`ERRO: ${data.message}`);
          toast.error("Suno falhou", data.message);
          return;
        }
      } catch {}
    }
    setResultDebug("Timeout: Suno demorou mais de 7min. Tente novamente.");
    toast.error("Timeout — Suno muito lento, tente novamente");
  };

  const gerar = async () => {
    if (!form.descricao.trim()) return toast.error("Descreva o estilo/mood");
    setLoading(true);
    setResult(null);
    setResultDebug("Enviando pro Suno...");
    try {
      const descCompleta = `${form.descricao}, duration approximately ${form.duracao_seg} seconds`;
      const r = await fetch("/api/youtube/trilha", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, descricao: descCompleta }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setResultDebug(`Task criada: ${data.task_id}. Aguardando Suno gerar (1-3min)...`);
      // inicia polling assincrono
      pollStatus(data.trilha_id);
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
              <Label>Duração (segundos)</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.duracao_seg} onChange={(e) => setForm({ ...form, duracao_seg: Number(e.target.value) })}>
                {DURACOES_SUGERIDAS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <div className="text-[10px] text-muted-foreground mt-1">Suno respeita aproximadamente</div>
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

      {resultDebug && (
        <div className="p-2 bg-background/40 border border-border rounded text-[10px] font-mono text-muted-foreground">
          DEBUG: {resultDebug}
        </div>
      )}

      {result && (
        <Card id="trilha-resultado" className="border-green-500/30 bg-green-500/5">
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

      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Suas trilhas geradas ({historico.length})</CardTitle>
              <Button size="sm" variant="ghost" onClick={loadHistorico}>↻ Atualizar</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {historico.map((t) => (
              <div key={t.id} className="border border-border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm line-clamp-1">
                      {t.titulo_variacao || t.prompt_descricao.slice(0, 60)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[9px] mr-1">{t.tipo}</Badge>
                      {t.duracao_sec && <span>{Math.round(t.duracao_sec)}s · </span>}
                      {new Date(t.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
                <audio src={t.url} controls className="w-full" />
                <div className="flex gap-2">
                  <a href={t.url} download={`trilha-${t.id.slice(0, 6)}-v1.mp3`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full"><Download className="h-3 w-3" /> v1</Button>
                  </a>
                  {t.url_variacao_2 && (
                    <a href={t.url_variacao_2} download={`trilha-${t.id.slice(0, 6)}-v2.mp3`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full"><Download className="h-3 w-3" /> v2</Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
