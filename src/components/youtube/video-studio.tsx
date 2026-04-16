"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Mic, Scissors, Image as ImageIcon, Sparkles, Copy, Check,
  Download, Play, Wand2, Upload, Film,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { removePausesFromAudio } from "@/lib/youtube/remove-pauses";

interface Voice { voice_id: string; name: string; descricao?: string; labels?: Record<string, string>; preview_url?: string }
interface VideoImg { id: string; url: string; ordem: number; prompt: string }
interface ThumbRes { url: string; padroes_detectados: Record<string, unknown>; thumbs_analisadas: number }
interface Canal { id: string; channel_name: string }

export function VideoStudio() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // === STEP 1: voz ===
  const [voices, setVoices] = useState<Voice[]>([]);
  const [vozLoading, setVozLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const [vozForm, setVozForm] = useState({
    text: "",
    voice_id: "",
    stability: 0.5,
    similarity_boost: 0.75,
  });

  const vozSelecionada = voices.find((v) => v.voice_id === vozForm.voice_id);

  const tocarPreview = () => {
    if (!vozSelecionada?.preview_url) {
      toast.error("Essa voz nao tem preview disponivel");
      return;
    }
    const audio = new Audio(vozSelecionada.preview_url);
    setPreviewPlaying(vozSelecionada.voice_id);
    audio.onended = () => setPreviewPlaying(null);
    audio.onerror = () => { setPreviewPlaying(null); toast.error("Erro ao carregar preview"); };
    audio.play().catch(() => setPreviewPlaying(null));
  };

  // === STEP 2: remove pauses ===
  const [pausasLoading, setPausasLoading] = useState(false);
  const [audioLimpoUrl, setAudioLimpoUrl] = useState<string | null>(null);
  const [audioLimpoBlob, setAudioLimpoBlob] = useState<Blob | null>(null);

  // === STEP 3: imagens ===
  const [imgsLoading, setImgsLoading] = useState(false);
  const [imagens, setImagens] = useState<VideoImg[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [imgsForm, setImgsForm] = useState({ titulo: "", qtd: 12, tema: "", modelo: "flux-schnell" });
  const [apenasPrompts, setApenasPrompts] = useState<Array<{ ordem: number; descricao_cena: string; prompt_ingles: string }>>([]);
  const [imgErros, setImgErros] = useState<Array<{ ordem: number; erro: string }>>([]);

  // === STEP 4: ANIMAR ===
  const [animLoading, setAnimLoading] = useState(false);
  const [animProgress, setAnimProgress] = useState("");
  const [animForm, setAnimForm] = useState({ modelo: "veo-3-fast", duration: 5, prompt_movimento: "" });
  const [videosAnimados, setVideosAnimados] = useState<Array<{ source_img_id: string; video_url: string }>>([]);

  // === STEP 5: MONTAR VIDEO ===
  const [montarLoading, setMontarLoading] = useState(false);
  const [montarStatus, setMontarStatus] = useState("");
  const [videoFinalUrl, setVideoFinalUrl] = useState<string | null>(null);

  // === STEP 4: thumbnail ===
  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumb, setThumb] = useState<ThumbRes | null>(null);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [thumbForm, setThumbForm] = useState({ titulo: "", canal_referencia_id: "", estilo_custom: "", texto_destaque: "", referencia_url: "" });
  const [refUploading, setRefUploading] = useState(false);

  useEffect(() => {
    fetch("/api/youtube/voz").then((r) => r.json()).then((d) => {
      const curadasBase = (d.curadas || []) as Voice[];
      const apiVoices = (d.voices || []) as Voice[];
      // merge: pra cada curada, puxa preview_url da API se existir
      const curadas = curadasBase.map((c) => {
        const apiV = apiVoices.find((v) => v.voice_id === c.voice_id);
        return apiV ? { ...c, preview_url: apiV.preview_url } : c;
      });
      const outras = apiVoices.filter((v) => !curadas.find((c) => c.voice_id === v.voice_id));
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

  const [imgDebug, setImgDebug] = useState<string>("");

  const carregarImagensExistentes = async () => {
    if (!imgsForm.titulo.trim()) return toast.error("Informe o titulo pra buscar");
    setImgsLoading(true);
    try {
      const r = await fetch(`/api/youtube/imagens-video?titulo=${encodeURIComponent(imgsForm.titulo)}`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const imgs = (data || []).map((d: { id: string; url: string; position: number; prompt_usado?: string }) => ({
        id: d.id, url: d.url, ordem: (d.position || 0) + 1, prompt: d.prompt_usado || "",
      }));
      setImagens(imgs);
      setSelecionadas(new Set());
      setImgDebug(`carregadas ${imgs.length} imagens do DB pra titulo "${imgsForm.titulo}"`);
      toast.success(`${imgs.length} imagens carregadas do historico`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setImgsLoading(false); }
  };

  const gerarImagens = async (comImagens: boolean) => {
    if (!imgsForm.titulo.trim()) return toast.error("Informe o titulo");
    setImgsLoading(true); setImagens([]); setApenasPrompts([]); setImgErros([]); setSelecionadas(new Set()); setVideosAnimados([]);
    setImgDebug("");
    try {
      const r = await fetch("/api/youtube/imagens-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...imgsForm, gerar_imagens: comImagens }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setImgDebug(`resposta: ${JSON.stringify({
        total_prompts: data.total_prompts,
        total_imagens: data.total_imagens,
        imagens_array_len: Array.isArray(data.imagens) ? data.imagens.length : "nao-array",
        erros_count: Array.isArray(data.erros) ? data.erros.length : 0,
      })}`);
      if (comImagens) {
        setImagens(data.imagens || []);
        setImgErros(data.erros || []);
        if (!data.imagens || data.imagens.length === 0) setApenasPrompts(data.prompts || []);
      } else {
        setApenasPrompts(data.prompts || []);
      }
      if (comImagens) {
        const suc = data.total_imagens || 0;
        const esp = data.total_prompts || 0;
        toast.success(`${suc} de ${esp} imagens geradas`, suc < esp ? `${esp - suc} falharam — prompts disponiveis pra regerar` : "");
      } else {
        toast.success(`${data.total_prompts} prompts gerados`);
      }
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setImgsLoading(false); }
  };

  const toggleSelecionada = (id: string) => {
    const novo = new Set(selecionadas);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionadas(novo);
  };
  const selecionarTodas = () => setSelecionadas(new Set(imagens.map((i) => i.id)));
  const limparSelecao = () => setSelecionadas(new Set());

  const baixarImagem = (url: string, nome: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.target = "_blank";
    link.click();
  };

  const baixarSelecionadas = async () => {
    const sel = imagens.filter((i) => selecionadas.has(i.id));
    for (const im of sel) {
      baixarImagem(im.url, `yt-img-${im.ordem}.png`);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const animar = async (lista?: VideoImg[]) => {
    const imgs = lista || imagens.filter((i) => selecionadas.has(i.id));
    if (imgs.length === 0) return toast.error("Sem imagens pra animar");
    if (imgs.length > 16) return toast.error("Maximo 16 por vez");
    setAnimLoading(true);
    setVideosAnimados([]);
    setAnimProgress(`Animando 0/${imgs.length}...`);
    try {
      const r = await fetch("/api/youtube/animar-imagens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagens: imgs.map((i) => ({ id: i.id, url: i.url, prompt: i.prompt })),
          modelo: animForm.modelo,
          duration: animForm.duration,
          prompt_movimento: animForm.prompt_movimento,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setVideosAnimados(data.videos || []);
      const errosMsg = Array.isArray(data.erros) && data.erros.length > 0
        ? `\nErros: ${data.erros.map((e: { source_img_id: string; erro: string }) => e.erro).slice(0, 3).join(" | ")}`
        : "";
      setAnimProgress(`${data.total_sucesso} de ${imgs.length} prontas${errosMsg}`);
      if (data.total_sucesso > 0) toast.success(`${data.total_sucesso} animacoes prontas`);
      else toast.error(`0 animacoes — ${data.erros?.[0]?.erro || "erro desconhecido"}`);
    } catch (e: unknown) {
      setAnimProgress("");
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setAnimLoading(false); }
  };

  const montarVideo = async () => {
    if (videosAnimados.length === 0) return toast.error("Anime as imagens primeiro (passo 4)");
    const audioSrc = audioLimpoUrl || audioUrl;
    setMontarLoading(true);
    setMontarStatus("Enviando pro Shotstack...");
    setVideoFinalUrl(null);
    try {
      const r = await fetch("/api/youtube/montar-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clips: videosAnimados.map((v) => ({ url: v.video_url, duration: animForm.duration })),
          audio_url: audioSrc || undefined,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const renderId = data.render_id;
      if (!renderId) throw new Error("Sem render_id");
      // poll status
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        setMontarStatus(`Renderizando... (${(i + 1) * 5}s)`);
        const sr = await fetch(`/api/youtube/montar-video?render_id=${renderId}`);
        if (!sr.ok) continue;
        const sd = await sr.json();
        if (sd.status === "done" && sd.video_url) {
          setVideoFinalUrl(sd.video_url);
          setMontarStatus("Video pronto!");
          toast.success("Video final pronto! Baixe abaixo.");
          return;
        }
        if (sd.status === "failed") {
          setMontarStatus(`Falhou: ${sd.message}`);
          toast.error("Shotstack falhou", sd.message);
          return;
        }
      }
      setMontarStatus("Timeout — render demorou demais");
    } catch (e: unknown) {
      setMontarStatus("");
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setMontarLoading(false); }
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
          texto_destaque: thumbForm.texto_destaque || null,
          referencia_url: thumbForm.referencia_url || null,
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
    { num: 2 as const, label: "Pausas", icon: Scissors },
    { num: 3 as const, label: "Imagens", icon: ImageIcon },
    { num: 4 as const, label: "Animar", icon: Play },
    { num: 5 as const, label: "Montar video", icon: Film },
    { num: 6 as const, label: "Thumbnail", icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
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
                Max 80.000 chars. {vozForm.text.length.toLocaleString()} chars. ~{Math.ceil(vozForm.text.length / 150)}s de audio · {Math.ceil(vozForm.text.length / 4500)} chunks (pode levar alguns minutos pra textos grandes)
              </div>
            </div>

            <div>
              <Label>Voz</Label>
              <div className="flex gap-2 mt-1">
                <select className="flex-1 flex h-10 rounded-md border border-input bg-background/40 px-3 text-sm"
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
                <Button variant="outline" size="icon" onClick={tocarPreview}
                  disabled={!vozSelecionada?.preview_url || previewPlaying === vozSelecionada?.voice_id}
                  title={vozSelecionada?.preview_url ? "Ouvir previa" : "Sem preview"}>
                  {previewPlaying === vozSelecionada?.voice_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
              {!vozSelecionada?.preview_url && vozSelecionada && (
                <div className="text-[10px] text-muted-foreground mt-1">Essa voz nao tem previa (rara em vozes clonadas)</div>
              )}
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
              <div>
                <Label>Modelo de imagem</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={imgsForm.modelo} onChange={(e) => setImgsForm({ ...imgsForm, modelo: e.target.value })}>
                  <option value="flux-schnell">Flux Schnell (rapido · ~$0.003/img)</option>
                  <option value="flux-pro">Flux Pro (qualidade · ~$0.05/img)</option>
                  <option value="ideogram">Ideogram v2 (texto na img · ~$0.08/img)</option>
                  <option value="gemini">Gemini Nano Banana (cota diaria)</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Tema/contexto</Label>
              <Textarea className="mt-1" value={imgsForm.tema}
                onChange={(e) => setImgsForm({ ...imgsForm, tema: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => gerarImagens(false)} disabled={imgsLoading}>
                {imgsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "So prompts"}
              </Button>
              <Button onClick={() => gerarImagens(true)} disabled={imgsLoading}>
                {imgsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wand2 className="h-4 w-4" /> Prompts + imagens</>}
              </Button>
              <Button variant="outline" onClick={carregarImagensExistentes} disabled={imgsLoading} title="Busca imagens ja geradas pelo mesmo titulo">
                {imgsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar do historico"}
              </Button>
            </div>

            {imgDebug && (
              <div className="p-2 bg-background/40 border border-border rounded text-[10px] font-mono text-muted-foreground">
                {imgDebug}
              </div>
            )}

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

            {imgErros.length > 0 && (
              <div className="p-3 bg-red-500/5 border border-red-500/30 rounded text-xs">
                <div className="font-bold text-red-400 mb-1">{imgErros.length} imagens falharam:</div>
                {imgErros.slice(0, 3).map((e, i) => (
                  <div key={i} className="text-muted-foreground">#{e.ordem}: {e.erro}</div>
                ))}
              </div>
            )}

            {imagens.length > 0 && (
              <>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="text-sm font-bold">
                    {imagens.length} imagens · {selecionadas.size} selecionadas
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={selecionarTodas}>Todas</Button>
                    <Button size="sm" variant="ghost" onClick={limparSelecao}>Limpar</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {imagens.sort((a, b) => a.ordem - b.ordem).map((im) => {
                    const sel = selecionadas.has(im.id);
                    return (
                      <div key={im.id} className={`relative aspect-video rounded overflow-hidden border-2 transition-colors cursor-pointer ${sel ? "border-cyan" : "border-border hover:border-cyan/50"}`}
                        onClick={() => toggleSelecionada(im.id)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.url} alt="" className="w-full h-full object-cover" />
                        <Badge className="absolute top-1 left-1 text-[9px]" variant="secondary">#{im.ordem}</Badge>
                        <input type="checkbox" checked={sel} onChange={() => {}}
                          className="absolute top-1 right-1 h-4 w-4 accent-cyan cursor-pointer" />
                        <div className="absolute bottom-1 right-1 flex gap-1">
                          <Button size="icon" variant="secondary" className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); baixarImagem(im.url, `yt-img-${im.ordem}.png`); }}>
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selecionadas.size > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-cyan/5 border border-cyan/30 rounded">
                    <div className="text-sm font-bold">{selecionadas.size} selecionadas</div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={baixarSelecionadas} className="flex-1">
                        <Download className="h-4 w-4" /> Baixar selecionadas
                      </Button>
                    </div>

                    {/* Animar */}
                    <div className="border-t border-cyan/20 pt-2 mt-1 space-y-2">
                      <div className="text-xs font-bold">Animar com IA (imagem → video 5-10s)</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Modelo</Label>
                          <select className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background/40 px-2 text-xs"
                            value={animForm.modelo} onChange={(e) => setAnimForm({ ...animForm, modelo: e.target.value })}>
                            <optgroup label="Google (usa GEMINI_API_KEY)">
                              <option value="veo-3">Veo 3 (top qualidade · ~$0.50)</option>
                              <option value="veo-3-fast">Veo 3 Fast (rapido · ~$0.20)</option>
                              <option value="veo-2">Veo 2 (mais barato · ~$0.10)</option>
                            </optgroup>
                            <optgroup label="fal.ai (precisa FAL_KEY)">
                              <option value="kling">Kling (~$0.30)</option>
                              <option value="ltx">LTX Video (~$0.10)</option>
                              <option value="luma">Luma Dream (~$0.40)</option>
                            </optgroup>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Duracao (s)</Label>
                          <Input type="number" className="mt-0.5 h-8 text-xs" min={3} max={10}
                            value={animForm.duration} onChange={(e) => setAnimForm({ ...animForm, duration: Number(e.target.value) })} />
                        </div>
                      </div>
                      <Input placeholder="Prompt de movimento (opcional, ex: slow zoom in, cinematic)"
                        className="h-8 text-xs"
                        value={animForm.prompt_movimento}
                        onChange={(e) => setAnimForm({ ...animForm, prompt_movimento: e.target.value })} />
                      <Button onClick={() => animar()} disabled={animLoading} className="w-full">
                        {animLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Animando (pode levar 2-5min)...</> : <><Play className="h-4 w-4" /> Animar {selecionadas.size}</>}
                      </Button>
                    </div>
                  </div>
                )}

                {videosAnimados.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="text-sm font-bold">Videos animados</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {videosAnimados.map((v, i) => (
                        <div key={i} className="space-y-1">
                          <video src={v.video_url} controls className="w-full rounded border border-border aspect-video" />
                          <a href={v.video_url} download={`yt-video-anim-${i + 1}.mp4`}>
                            <Button size="sm" variant="outline" className="w-full"><Download className="h-3 w-3" /> Baixar</Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={() => setStep(4)} className="w-full">Proximo →</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: animar */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">4. Animar todas as imagens</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {imagens.length === 0 ? (
              <div className="text-sm text-muted-foreground">Gere imagens no passo 3 primeiro.</div>
            ) : (
              <>
                <div className="text-sm">{imagens.length} imagens prontas pra animar.</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px]">Modelo</Label>
                    <select className="mt-0.5 flex h-9 w-full rounded-md border border-input bg-background/40 px-2 text-xs"
                      value={animForm.modelo} onChange={(e) => setAnimForm({ ...animForm, modelo: e.target.value })}>
                      <optgroup label="Google (GEMINI_API_KEY)">
                        <option value="veo-3">Veo 3 (top · ~$0.50)</option>
                        <option value="veo-3-fast">Veo 3 Fast (rapido · ~$0.20)</option>
                        <option value="veo-2">Veo 2 (~$0.10)</option>
                      </optgroup>
                      <optgroup label="fal.ai (FAL_KEY)">
                        <option value="kling">Kling (~$0.30)</option>
                        <option value="ltx">LTX (~$0.10)</option>
                        <option value="luma">Luma (~$0.40)</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Duracao (s)</Label>
                    <Input type="number" className="mt-0.5 h-9 text-xs" min={3} max={10}
                      value={animForm.duration} onChange={(e) => setAnimForm({ ...animForm, duration: Number(e.target.value) })} />
                  </div>
                </div>
                <Input placeholder="Prompt de movimento (ex: slow zoom in, cinematic pan)" className="text-xs"
                  value={animForm.prompt_movimento}
                  onChange={(e) => setAnimForm({ ...animForm, prompt_movimento: e.target.value })} />
                {animProgress && <div className="text-xs text-muted-foreground">{animProgress}</div>}
                <Button onClick={() => animar(imagens)} disabled={animLoading} className="w-full">
                  {animLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Animando...</> : <><Play className="h-4 w-4" /> Animar todas ({imagens.length} imagens)</>}
                </Button>

                {videosAnimados.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="text-sm font-bold">{videosAnimados.length} clips animados</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {videosAnimados.map((v, i) => (
                        <div key={i} className="space-y-1">
                          <video src={v.video_url} controls className="w-full rounded border border-border aspect-video" />
                          <a href={v.video_url} download={`clip-${i + 1}.mp4`}>
                            <Button size="sm" variant="outline" className="w-full"><Download className="h-3 w-3" /> Clip {i + 1}</Button>
                          </a>
                        </div>
                      ))}
                    </div>
                    <Button onClick={() => setStep(5)} className="w-full">Proximo: montar video final →</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 5: montar video */}
      {step === 5 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">5. Montar video final</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {videosAnimados.length === 0 ? (
              <div className="text-sm text-muted-foreground">Anime as imagens no passo 4 primeiro.</div>
            ) : (
              <>
                <div className="text-sm">{videosAnimados.length} clips + {audioUrl || audioLimpoUrl ? "audio pronto" : "sem audio"}</div>
                <div className="p-3 bg-cyan/5 border border-cyan/30 rounded text-xs text-muted-foreground space-y-1">
                  <div><b>Clips animados:</b> {videosAnimados.length} x {animForm.duration}s = {videosAnimados.length * animForm.duration}s total</div>
                  <div><b>Audio:</b> {audioLimpoUrl ? "narracao (sem pausas)" : audioUrl ? "narracao (original)" : "nenhum"}</div>
                </div>
                {montarStatus && <div className="text-xs text-muted-foreground font-mono">{montarStatus}</div>}
                <Button onClick={montarVideo} disabled={montarLoading} className="w-full">
                  {montarLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Renderizando...</> : <><Film className="h-4 w-4" /> Montar video final</>}
                </Button>

                {videoFinalUrl && (
                  <div className="space-y-2 border-t border-green-500/30 pt-3 bg-green-500/5 p-3 rounded">
                    <div className="text-sm font-bold text-green-400">Video final pronto!</div>
                    <video src={videoFinalUrl} controls className="w-full rounded border border-border aspect-video" />
                    <a href={videoFinalUrl} download="video-final.mp4">
                      <Button className="w-full"><Download className="h-4 w-4" /> Baixar MP4</Button>
                    </a>
                    <Button variant="outline" className="w-full" onClick={() => setStep(6)}>Proximo →</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 6: thumbnail */}
      {step === 6 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">6. Thumbnail magnetica</CardTitle></CardHeader>
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
              <Label>Texto de destaque (aparece NA thumb)</Label>
              <Input className="mt-1" placeholder="Ex: ELE FEZ R$40 MIL EM 30 DIAS"
                value={thumbForm.texto_destaque} onChange={(e) => setThumbForm({ ...thumbForm, texto_destaque: e.target.value })} />
              <div className="text-[10px] text-muted-foreground mt-1">
                {thumbForm.texto_destaque ? "Ideogram v2 vai renderizar esse texto na imagem (~$0.08)" : "Sem texto = Flux Pro gera imagem pura (~$0.05)"}
              </div>
            </div>

            <div>
              <Label>Imagem de referência (opcional)</Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="URL da imagem ou upload abaixo"
                  value={thumbForm.referencia_url}
                  onChange={(e) => setThumbForm({ ...thumbForm, referencia_url: e.target.value })} />
                <label className="flex items-center gap-1 px-3 border border-border rounded-md cursor-pointer hover:border-cyan/50 text-xs whitespace-nowrap">
                  <Upload className="h-3 w-3" /> Upload
                  <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setRefUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const r = await fetch("/api/social/upload", { method: "POST", body: fd });
                      if (!r.ok) throw new Error(await r.text());
                      const data = await r.json();
                      setThumbForm((f) => ({ ...f, referencia_url: data.url }));
                      toast.success("Referência carregada");
                    } catch { toast.error("Erro no upload"); }
                    finally { setRefUploading(false); }
                  }} />
                </label>
              </div>
              {refUploading && <div className="text-xs text-muted-foreground mt-1"><Loader2 className="h-3 w-3 inline animate-spin" /> Carregando...</div>}
              {thumbForm.referencia_url && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbForm.referencia_url} alt="" className="h-16 rounded border border-border" />
                  <Button size="sm" variant="ghost" onClick={() => setThumbForm({ ...thumbForm, referencia_url: "" })}>Remover</Button>
                </div>
              )}
            </div>

            <div>
              <Label>Estilo adicional (opcional)</Label>
              <Input className="mt-1" placeholder="Ex: cores vibrantes, fundo escuro, expressão de surpresa"
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
