"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Mic, Scissors, Image as ImageIcon, Sparkles, Copy, Check,
  Download, Play, Wand2,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { removePausesFromAudio } from "@/lib/youtube/remove-pauses";

interface Voice { voice_id: string; name: string; descricao?: string; labels?: Record<string, string> }
interface VideoImg { id: string; url: string; ordem: number; prompt: string }
interface ThumbRes { url: string; padroes_detectados: Record<string, unknown>; thumbs_analisadas: number }
interface Canal { id: string; channel_name: string }

export function VideoStudio() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // === STEP 1: voz ===
  const [voices, setVoices] = useState<Voice[]>([]);
  const [vozLoading, setVozLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [vozForm, setVozForm] = useState({
    text: "",
    voice_id: "",
    stability: 0.5,
    similarity_boost: 0.75,
  });

  // === STEP 2: remove pauses ===
  const [pausasLoading, setPausasLoading] = useState(false);
  const [audioLimpoUrl, setAudioLimpoUrl] = useState<string | null>(null);
  const [audioLimpoBlob, setAudioLimpoBlob] = useState<Blob | null>(null);

  // === STEP 3: imagens ===
  const [imgsLoading, setImgsLoading] = useState(false);
  const [imagens, setImagens] = useState<VideoImg[]>([]);
  const [imgsForm, setImgsForm] = useState({ titulo: "", qtd: 12, tema: "" });
  const [apenasPrompts, setApenasPrompts] = useState<Array<{ ordem: number; descricao_cena: string; prompt_ingles: string }>>([]);

  // === STEP 4: thumbnail ===
  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumb, setThumb] = useState<ThumbRes | null>(null);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [thumbForm, setThumbForm] = useState({ titulo: "", canal_referencia_id: "", estilo_custom: "" });

  useEffect(() => {
    fetch("/api/youtube/voz").then((r) => r.json()).then((d) => {
      const curadas = (d.curadas || []) as Voice[];
      // junta curadas + outras pt/es/en
      const outras = (d.voices || []).filter((v: Voice) => !curadas.find((c) => c.voice_id === v.voice_id));
      const all = [...curadas, ...outras];
      setVoices(all);
      if (all.length > 0 && !vozForm.voice_id) setVozForm((f) => ({ ...f, voice_id: all[0].voice_id }));
    }).catch(() => {});

    fetch("/api/youtube/canais-minerados").then((r) => r.ok ? r.json() : []).then((d) => setCanais(d || [])).catch(() => {});
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const gerarVoz = async () => {
    if (!vozForm.text.trim()) return toast.error("Cole o texto do roteiro");
    if (!vozForm.voice_id) return toast.error("Escolha uma voz");
    setVozLoading(true); setAudioUrl(null);
    try {
      const voz = voices.find((v) => v.voice_id === vozForm.voice_id);
      const r = await fetch("/api/youtube/voz", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...vozForm, voice_name: voz?.name }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setAudioUrl(data.url);
      toast.success("Audio gerado", `${data.chars} chars usados`);
    } catch (e: unknown) {
      toast.error("Erro voz", e instanceof Error ? e.message : "tente novamente");
    } finally { setVozLoading(false); }
  };

  const removerPausas = async () => {
    if (!audioUrl) return toast.error("Gere o audio primeiro");
    setPausasLoading(true); setAudioLimpoUrl(null);
    try {
      const blob = await (await fetch(audioUrl)).blob();
      const limpo = await removePausesFromAudio(blob);
      setAudioLimpoBlob(limpo);
      setAudioLimpoUrl(URL.createObjectURL(limpo));
      toast.success("Pausas removidas");
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setPausasLoading(false); }
  };

  const baixarAudioLimpo = () => {
    if (!audioLimpoBlob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(audioLimpoBlob);
    link.download = `audio-sem-pausas-${Date.now()}.wav`;
    link.click();
  };

  const gerarImagens = async (comImagens: boolean) => {
    if (!imgsForm.titulo.trim()) return toast.error("Informe o titulo");
    setImgsLoading(true); setImagens([]); setApenasPrompts([]);
    try {
      const r = await fetch("/api/youtube/imagens-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...imgsForm, gerar_imagens: comImagens }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (comImagens) setImagens(data.imagens || []);
      else setApenasPrompts(data.prompts || []);
      toast.success(comImagens ? `${data.total_imagens} imagens geradas` : `${data.total_prompts} prompts gerados`);
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setImgsLoading(false); }
  };

  const gerarThumb = async () => {
    if (!thumbForm.titulo.trim()) return toast.error("Informe o titulo");
    setThumbLoading(true); setThumb(null);
    try {
      const r = await fetch("/api/youtube/thumbnail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: thumbForm.titulo,
          canal_referencia_id: thumbForm.canal_referencia_id || null,
          estilo_custom: thumbForm.estilo_custom || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setThumb(data);
      toast.success("Thumb gerada", data.thumbs_analisadas > 0 ? `Modelando padrao de ${data.thumbs_analisadas} thumbs` : "Estilo generico");
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setThumbLoading(false); }
  };

  const copyPrompt = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.info("Copiado");
  };

  const STEPS = [
    { num: 1 as const, label: "Voz", icon: Mic },
    { num: 2 as const, label: "Remover pausas", icon: Scissors },
    { num: 3 as const, label: "Imagens do video", icon: ImageIcon },
    { num: 4 as const, label: "Thumbnail", icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = step === s.num;
          return (
            <button key={s.num} onClick={() => setStep(s.num)}
              className={`p-3 rounded-md border transition-colors ${active ? "border-cyan bg-cyan/10" : "border-border hover:border-cyan/50"}`}>
              <div className={`flex items-center gap-2 ${active ? "text-cyan" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" />
                <span className="text-xs font-bold">{s.num}. {s.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP 1: voz */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">1. Gerar voz com ElevenLabs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Texto do roteiro</Label>
              <Textarea className="mt-1 min-h-[180px]" placeholder="Cola aqui o roteiro gerado na aba anterior..."
                value={vozForm.text} onChange={(e) => setVozForm({ ...vozForm, text: e.target.value })} />
              <div className="text-[10px] text-muted-foreground mt-1">
                Max 5000 chars por request. {vozForm.text.length} chars. ~{Math.ceil(vozForm.text.length / 150)}s de audio estimado.
              </div>
            </div>

            <div>
              <Label>Voz</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={vozForm.voice_id} onChange={(e) => setVozForm({ ...vozForm, voice_id: e.target.value })}>
                <optgroup label="Curadas pra canal dark">
                  {voices.slice(0, 6).map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>{v.name}{v.descricao ? ` — ${v.descricao}` : ""}</option>
                  ))}
                </optgroup>
                <optgroup label="Todas as vozes">
                  {voices.slice(6).map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stability: {vozForm.stability}</Label>
                <input type="range" min={0} max={1} step={0.05} className="w-full mt-2"
                  value={vozForm.stability} onChange={(e) => setVozForm({ ...vozForm, stability: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Similarity: {vozForm.similarity_boost}</Label>
                <input type="range" min={0} max={1} step={0.05} className="w-full mt-2"
                  value={vozForm.similarity_boost} onChange={(e) => setVozForm({ ...vozForm, similarity_boost: Number(e.target.value) })} />
              </div>
            </div>

            <Button onClick={gerarVoz} disabled={vozLoading} className="w-full">
              {vozLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : <><Mic className="h-4 w-4" /> Gerar voz</>}
            </Button>

            {audioUrl && (
              <div className="space-y-2">
                <audio src={audioUrl} controls className="w-full" />
                <div className="flex gap-2">
                  <a href={audioUrl} download="audio-yt.mp3" className="flex-1">
                    <Button variant="outline" className="w-full"><Download className="h-4 w-4" /> Baixar</Button>
                  </a>
                  <Button className="flex-1" onClick={() => setStep(2)}>Proximo passo: remover pausas →</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: remove pauses */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">2. Remover pausas do audio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!audioUrl ? (
              <div className="text-sm text-muted-foreground">Gere o audio no passo 1 primeiro.</div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  Roda no seu navegador. Remove silencios acima de 1.5s abaixo de -40dB.
                </div>
                <Button onClick={removerPausas} disabled={pausasLoading} className="w-full">
                  {pausasLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : <><Scissors className="h-4 w-4" /> Remover pausas</>}
                </Button>

                {audioLimpoUrl && (
                  <div className="space-y-2">
                    <audio src={audioLimpoUrl} controls className="w-full" />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={baixarAudioLimpo}>
                        <Download className="h-4 w-4" /> Baixar WAV limpo
                      </Button>
                      <Button className="flex-1" onClick={() => setStep(3)}>Proximo: imagens →</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 3: imagens */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">3. Imagens 1920x1080 do video</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Titulo do video</Label>
              <Input className="mt-1" value={imgsForm.titulo}
                onChange={(e) => setImgsForm({ ...imgsForm, titulo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qtd de imagens (8-16)</Label>
                <Input type="number" min={8} max={16} className="mt-1" value={imgsForm.qtd}
                  onChange={(e) => setImgsForm({ ...imgsForm, qtd: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Tema/contexto</Label>
              <Textarea className="mt-1" value={imgsForm.tema}
                onChange={(e) => setImgsForm({ ...imgsForm, tema: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => gerarImagens(false)} disabled={imgsLoading}>
                {imgsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "So prompts"}
              </Button>
              <Button onClick={() => gerarImagens(true)} disabled={imgsLoading}>
                {imgsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wand2 className="h-4 w-4" /> Prompts + gerar imagens</>}
              </Button>
            </div>

            {apenasPrompts.length > 0 && (
              <div className="space-y-2">
                {apenasPrompts.map((p, i) => (
                  <div key={i} className="border border-border rounded p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">#{p.ordem}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => copyPrompt(p.prompt_ingles)}><Copy className="h-3 w-3" /></Button>
                    </div>
                    <div className="text-muted-foreground mt-1">{p.descricao_cena}</div>
                    <div className="font-mono text-[10px] mt-1">{p.prompt_ingles}</div>
                  </div>
                ))}
              </div>
            )}

            {imagens.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {imagens.sort((a, b) => a.ordem - b.ordem).map((im) => (
                    <div key={im.id} className="relative aspect-video rounded overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.url} alt="" className="w-full h-full object-cover" />
                      <Badge className="absolute top-1 left-1 text-[9px]" variant="secondary">#{im.ordem}</Badge>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setStep(4)} className="w-full">Proximo: thumbnail →</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: thumbnail */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">4. Thumbnail magnetica</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Titulo do video</Label>
              <Input className="mt-1" value={thumbForm.titulo}
                onChange={(e) => setThumbForm({ ...thumbForm, titulo: e.target.value })} />
            </div>

            <div>
              <Label>Canal de referencia (opcional)</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={thumbForm.canal_referencia_id} onChange={(e) => setThumbForm({ ...thumbForm, canal_referencia_id: e.target.value })}>
                <option value="">Nenhum (estilo livre)</option>
                {canais.map((c) => <option key={c.id} value={c.id}>{c.channel_name}</option>)}
              </select>
              <div className="text-[10px] text-muted-foreground mt-1">
                Se escolher, IA analisa thumbs dele via Claude Vision e modela a nova seguindo o padrao
              </div>
            </div>

            <div>
              <Label>Estilo adicional (opcional)</Label>
              <Input className="mt-1" placeholder="Ex: vermelho dominante, rosto chocado"
                value={thumbForm.estilo_custom} onChange={(e) => setThumbForm({ ...thumbForm, estilo_custom: e.target.value })} />
            </div>

            <Button onClick={gerarThumb} disabled={thumbLoading} className="w-full">
              {thumbLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando (pode levar 1min)...</> : <><Sparkles className="h-4 w-4" /> Gerar thumbnail</>}
            </Button>

            {thumb && (
              <div className="space-y-2">
                <div className="aspect-video rounded overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb.url} alt="thumbnail" className="w-full h-full object-cover" />
                </div>
                <a href={thumb.url} download="thumbnail.png">
                  <Button variant="outline" className="w-full"><Download className="h-4 w-4" /> Baixar thumbnail</Button>
                </a>
                {thumb.thumbs_analisadas > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <b>Padrao detectado:</b>
                    <pre className="text-[10px] mt-1 bg-background/40 p-2 rounded border border-border overflow-auto">
                      {JSON.stringify(thumb.padroes_detectados, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
