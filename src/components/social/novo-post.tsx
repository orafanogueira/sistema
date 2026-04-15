"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, X, Loader2, Upload, Sparkles, Trash2, Image as ImageIcon,
  Video, Instagram, Facebook, Linkedin, Music2, Youtube, Wand2, Calendar, Save,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0A66C2" },
  { value: "tiktok", label: "TikTok", icon: Music2, color: "#000000" },
  { value: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000" },
];

const FORMATS = [
  { value: "feed", label: "Feed quadrado", ratio: "1:1" },
  { value: "feed_vertical", label: "Feed vertical", ratio: "4:5" },
  { value: "carrossel", label: "Carrossel", ratio: "4:5" },
  { value: "reel", label: "Reels / Shorts", ratio: "9:16" },
  { value: "story", label: "Story", ratio: "9:16" },
  { value: "video", label: "Video longo", ratio: "16:9" },
];

interface Asset { id: string; url: string; tipo: string; position: number; }

export function NovoPostButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

  const [form, setForm] = useState({
    cliente_id: "",
    title: "",
    briefing: "",
    format: "feed",
    slides_count: 5,
    copy_base: "",
    scheduled_for: "",
    platforms: ["instagram"] as string[],
  });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [copies, setCopies] = useState<Record<string, string>>({});
  const [iaImgPrompt, setIaImgPrompt] = useState("");

  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));

  const upload = async (file: File) => {
    if (!form.cliente_id) return toast.error("Escolha cliente antes de upar");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("cliente_id", form.cliente_id);
    fd.append("position", String(assets.length));
    const r = await fetch("/api/social/upload", { method: "POST", body: fd });
    if (!r.ok) return toast.error("Upload", await r.text());
    const asset = await r.json();
    setAssets([...assets, asset]);
  };

  const gerarImagem = async () => {
    if (!iaImgPrompt.trim()) return toast.error("Descreva a imagem");
    if (!form.cliente_id) return toast.error("Escolha cliente antes");
    setImgLoading(true);
    try {
      const ratio = FORMATS.find((f) => f.value === form.format)?.ratio;
      // Gemini suporta: 1:1, 9:16, 16:9, 3:4, 4:3. 4:5 → mapeia pra 3:4 (mais proximo).
      const aspectRatio =
        ratio === "9:16" ? "9:16" :
        ratio === "16:9" ? "16:9" :
        ratio === "4:5" ? "3:4" :
        "1:1";
      const r = await fetch("/api/social/gerar-imagem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: iaImgPrompt, cliente_id: form.cliente_id, aspect_ratio: aspectRatio }),
      });
      if (!r.ok) throw new Error(await r.text());
      const asset = await r.json();
      setAssets([...assets, asset]);
      setIaImgPrompt("");
      toast.success("Imagem gerada");
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setImgLoading(false); }
  };

  const removeAsset = async (id: string) => {
    await fetch(`/api/social/upload?id=${id}`, { method: "DELETE" });
    setAssets(assets.filter((a) => a.id !== id));
  };

  const adaptarCopy = async () => {
    if (!form.copy_base.trim()) return toast.error("Escreva uma copy base primeiro");
    if (form.platforms.length === 0) return toast.error("Selecione ao menos 1 plataforma");
    setCopyLoading(true);
    try {
      const r = await fetch("/api/social/adaptar-copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copy_base: form.copy_base,
          contexto: form.briefing,
          platforms: form.platforms,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setCopies(data.copies);
      toast.success("Copies geradas", "Revisa cada rede antes de publicar");
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setCopyLoading(false); }
  };

  const save = async () => {
    if (!form.cliente_id) return toast.error("Escolha cliente");
    if (!form.title) return toast.error("Escolha um titulo");
    if (form.platforms.length === 0) return toast.error("Selecione plataformas");

    setLoading(true);
    try {
      const mediaUrls = assets.map((a, i) => ({ url: a.url, type: a.tipo, position: i }));
      const payload = {
        cliente_id: form.cliente_id,
        title: form.title,
        briefing: form.briefing,
        format: form.format,
        platform: form.platforms[0],
        platforms: form.platforms,
        copy: copies[form.platforms[0]] || form.copy_base,
        copies_by_platform: copies,
        midia_urls: mediaUrls,
        scheduled_for: form.scheduled_for || null,
        status: form.scheduled_for ? "agendado" : "rascunho",
        asset_ids: assets.map((a) => a.id),
      };
      const r = await fetch("/api/social-posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Post criado", form.scheduled_for ? "Agendado" : "Salvo como rascunho");
      setOpen(false);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo post</Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(860px,94vw)] max-h-[92vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Novo post — multi-plataforma</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-4">
              {/* dados base */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cliente *</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                    <option value="">Selecione</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Titulo interno</Label>
                  <Input className="mt-1" placeholder="Ex: Post sobre a promocao de outubro"
                    value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
              </div>

              {/* formato */}
              <div>
                <Label>Formato</Label>
                <div className="grid grid-cols-6 gap-2 mt-1">
                  {FORMATS.map((f) => (
                    <button key={f.value} onClick={() => setForm({ ...form, format: f.value })}
                      className={`p-3 rounded-md border text-xs font-semibold transition-colors ${form.format === f.value ? "border-cyan bg-cyan/10 text-cyan" : "border-border hover:border-cyan/50"}`}>
                      {f.label}
                      <div className="text-[10px] font-normal text-muted-foreground mt-1">{f.ratio}</div>
                    </button>
                  ))}
                </div>
                {form.format === "carrossel" && (
                  <div className="mt-2 flex items-center gap-3">
                    <Label className="whitespace-nowrap">Qtd de slides:</Label>
                    <Input type="number" min={2} max={10} className="w-20"
                      value={form.slides_count}
                      onChange={(e) => setForm({ ...form, slides_count: Math.min(10, Math.max(2, Number(e.target.value) || 2)) })} />
                    <span className="text-xs text-muted-foreground">Min 2, max 10 (limite IG)</span>
                  </div>
                )}
              </div>

              {/* plataformas */}
              <div>
                <Label>Plataformas (publicar em)</Label>
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {PLATFORMS.map((p) => {
                    const on = form.platforms.includes(p.value);
                    const Icon = p.icon;
                    return (
                      <button key={p.value} onClick={() => togglePlatform(p.value)}
                        className={`p-3 rounded-md border flex flex-col items-center gap-1 text-xs font-semibold transition-colors ${on ? "border-cyan bg-cyan/10 text-cyan" : "border-border hover:border-cyan/50 text-muted-foreground"}`}>
                        <Icon className="h-5 w-5" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* midia */}
              <div>
                <Label>Midia</Label>
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                  <label className="border border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-cyan/50 transition-colors">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <div className="text-xs text-muted-foreground">Clique pra upar (imagem ate 15MB, video ate 200MB)</div>
                    <input type="file" className="hidden" accept="image/*,video/mp4,video/quicktime"
                      onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  </label>
                  <div className="border border-cyan/30 bg-cyan/5 rounded-md p-3 flex flex-col items-center justify-center min-w-[180px]">
                    <Sparkles className="h-5 w-5 text-cyan mb-2" />
                    <div className="text-xs font-bold mb-1">Gerar com IA</div>
                    <Input className="text-xs h-8" placeholder="Descreva a cena..."
                      value={iaImgPrompt} onChange={(e) => setIaImgPrompt(e.target.value)} />
                    <Button size="sm" className="mt-2 w-full h-7 text-xs" onClick={gerarImagem} disabled={imgLoading}>
                      {imgLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wand2 className="h-3 w-3" /> Gerar</>}
                    </Button>
                  </div>
                </div>
                {(assets.length > 0 || form.format === "carrossel") && (
                  <div className="mt-3">
                    {form.format === "carrossel" && (
                      <div className="text-xs text-muted-foreground mb-2">
                        Progresso: {assets.length}/{form.slides_count} slides
                      </div>
                    )}
                    <div className="grid grid-cols-5 gap-2">
                      {assets.map((a, i) => (
                        <div key={a.id} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                          {a.tipo === "video" ? (
                            <div className="flex items-center justify-center h-full bg-background">
                              <Video className="h-6 w-6 text-muted-foreground" />
                            </div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt="" className="w-full h-full object-cover" />
                          )}
                          <button onClick={() => removeAsset(a.id)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <Badge className="absolute bottom-1 left-1 text-[9px]" variant="secondary">Slide {i + 1}</Badge>
                        </div>
                      ))}
                      {form.format === "carrossel" && Array.from({ length: Math.max(0, form.slides_count - assets.length) }).map((_, i) => (
                        <div key={`placeholder-${i}`}
                          className="aspect-square rounded-md border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">
                          Slide {assets.length + i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* briefing */}
              <div>
                <Label>Briefing (contexto pra IA)</Label>
                <Textarea className="mt-1" placeholder="Sobre o que e esse post? Objetivo? Tom?"
                  value={form.briefing} onChange={(e) => setForm({ ...form, briefing: e.target.value })} />
              </div>

              {/* copy base + adaptador */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>Copy base</Label>
                  <Button size="sm" variant="outline" onClick={adaptarCopy} disabled={copyLoading}>
                    {copyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Sparkles className="h-3 w-3" /> Adaptar por plataforma</>}
                  </Button>
                </div>
                <Textarea className="mt-1 min-h-[100px]"
                  placeholder="Escreve uma versao geral que a IA adapta pra cada rede"
                  value={form.copy_base} onChange={(e) => setForm({ ...form, copy_base: e.target.value })} />
              </div>

              {/* copies adaptadas */}
              {Object.keys(copies).length > 0 && (
                <div className="space-y-2">
                  <Label>Copies adaptadas (editavel)</Label>
                  {form.platforms.map((p) => {
                    const platform = PLATFORMS.find((x) => x.value === p);
                    if (!platform || !copies[p]) return null;
                    const Icon = platform.icon;
                    return (
                      <div key={p} className="border border-border rounded-md p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4" style={{ color: platform.color }} />
                          <span className="font-bold text-sm">{platform.label}</span>
                          <Badge variant="outline" className="ml-auto text-[10px]">{(copies[p] || "").length} chars</Badge>
                        </div>
                        <Textarea className="text-xs" value={copies[p]}
                          onChange={(e) => setCopies({ ...copies, [p]: e.target.value })} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* agendamento */}
              <div>
                <Label>Agendar para (opcional)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input type="datetime-local" value={form.scheduled_for}
                    onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Deixe vazio pra salvar como rascunho
                </div>
              </div>

              <Button onClick={save} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> {form.scheduled_for ? "Agendar" : "Salvar rascunho"}</>}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
