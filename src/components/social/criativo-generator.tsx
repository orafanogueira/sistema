"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Download, Upload, Wand2, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface SlidePrompt { ordem: number; titulo: string; texto: string; prompt_detalhe: string }
interface SlideResult { ordem: number; titulo: string; texto: string; url?: string }

export function CriativoGenerator({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [loading, setLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [form, setForm] = useState({
    cliente_id: "",
    tema: "",
    objetivo: "educacional",
    slides_count: 5,
    publico: "",
    cor_primaria: "#0055cc",
    cor_secundaria: "#00c8e0",
    marca: "Grupo Nogueira",
    referencia_url: "",
    prompt_global: "",
  });
  const [slidesPrompts, setSlidesPrompts] = useState<SlidePrompt[]>([]);
  const [slidesResults, setSlidesResults] = useState<SlideResult[]>([]);
  const [refUploading, setRefUploading] = useState(false);

  const gerarEstrutura = async () => {
    if (!form.tema.trim()) return toast.error("Informe o tema");
    setLoading(true);
    setSlidesPrompts([]);
    setSlidesResults([]);
    try {
      const r = await fetch("/api/social/gerar-carrossel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefing: `${form.tema}. Objetivo: ${form.objetivo}. Público: ${form.publico || "geral"}. ${form.prompt_global}`,
          slides_count: form.slides_count,
          cliente_id: form.cliente_id || null,
          aspect_ratio: "1:1",
          gerar_imagens: false,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const slides = (data.slides || []).map((s: { ordem: number; titulo: string; texto: string; prompt_imagem: string }) => ({
        ordem: s.ordem,
        titulo: s.titulo,
        texto: s.texto,
        prompt_detalhe: s.prompt_imagem || "",
      }));
      setSlidesPrompts(slides);
      setSlidesResults(slides.map((s: SlidePrompt) => ({ ordem: s.ordem, titulo: s.titulo, texto: s.texto })));
      toast.success(`${slides.length} slides criados — agora gere as imagens`);
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const gerarImagemSlide = async (slideIdx: number) => {
    const slide = slidesPrompts[slideIdx];
    if (!slide) return;
    setImgLoading(true);
    try {
      const prompt = slide.prompt_detalhe || `Visual for: ${slide.titulo}. ${slide.texto}`;
      const fullPrompt = form.referencia_url
        ? `${prompt}. Style reference from uploaded image. Brand colors: ${form.cor_primaria}, ${form.cor_secundaria}`
        : `${prompt}. Brand colors: ${form.cor_primaria}, ${form.cor_secundaria}. Clean design, no text.`;

      const r = await fetch("/api/social/gerar-imagem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          cliente_id: form.cliente_id || null,
          aspect_ratio: "1:1",
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const asset = await r.json();
      const updated = [...slidesResults];
      updated[slideIdx] = { ...updated[slideIdx], url: asset.url };
      setSlidesResults(updated);
      toast.success(`Slide ${slide.ordem} gerado`);
    } catch (e: unknown) {
      toast.error("Erro imagem", e instanceof Error ? e.message : "tente novamente");
    } finally { setImgLoading(false); }
  };

  const gerarTodasImagens = async () => {
    setImgLoading(true);
    for (let i = 0; i < slidesPrompts.length; i++) {
      if (slidesResults[i]?.url) continue;
      await gerarImagemSlide(i);
      await new Promise((r) => setTimeout(r, 2000));
    }
    setImgLoading(false);
    toast.success("Todas as imagens geradas!");
  };

  const updateSlidePrompt = (idx: number, field: keyof SlidePrompt, value: string) => {
    const updated = [...slidesPrompts];
    updated[idx] = { ...updated[idx], [field]: value };
    setSlidesPrompts(updated);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan" /> Gerador de Criativos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">Selecione</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <Label>Objetivo</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })}>
                <option value="educacional">Educacional</option>
                <option value="venda">Venda</option>
                <option value="autoridade">Autoridade</option>
                <option value="engajamento">Engajamento</option>
                <option value="bastidores">Bastidores</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Tema do criativo *</Label>
            <Input className="mt-1" placeholder="Ex: 5 erros ao escolher carro usado"
              value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Qtd de slides</Label>
              <Input type="number" min={1} max={10} className="mt-1" value={form.slides_count}
                onChange={(e) => setForm({ ...form, slides_count: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Cor primária</Label>
              <Input type="color" className="mt-1 h-10 p-1" value={form.cor_primaria}
                onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })} />
            </div>
            <div>
              <Label>Cor secundária</Label>
              <Input type="color" className="mt-1 h-10 p-1" value={form.cor_secundaria}
                onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Público-alvo (opcional)</Label>
            <Input className="mt-1" placeholder="Ex: mulheres 25-40, empreendedores, etc"
              value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value })} />
          </div>

          <div>
            <Label>Prompt global (instruções extras pra IA)</Label>
            <Textarea className="mt-1" placeholder="Ex: use estilo minimalista, fundo branco, ícones geométricos..."
              value={form.prompt_global} onChange={(e) => setForm({ ...form, prompt_global: e.target.value })} />
          </div>

          {/* Imagem de referência */}
          <div>
            <Label>Imagem de referência (identidade visual / estilo)</Label>
            <div className="flex gap-2 mt-1">
              <Input placeholder="URL da imagem ou upload"
                value={form.referencia_url}
                onChange={(e) => setForm({ ...form, referencia_url: e.target.value })} />
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
                    setForm((f) => ({ ...f, referencia_url: data.url }));
                    toast.success("Referência carregada");
                  } catch { toast.error("Erro upload"); }
                  finally { setRefUploading(false); }
                }} />
              </label>
            </div>
            {refUploading && <div className="text-xs text-muted-foreground mt-1"><Loader2 className="h-3 w-3 inline animate-spin" /> Carregando...</div>}
            {form.referencia_url && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.referencia_url} alt="" className="h-16 rounded border border-border" />
                <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, referencia_url: "" })}><Trash2 className="h-3 w-3" /></Button>
              </div>
            )}
          </div>

          <Button onClick={gerarEstrutura} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando estrutura...</> : <><Sparkles className="h-4 w-4" /> Gerar {form.slides_count} slides</>}
          </Button>
        </CardContent>
      </Card>

      {/* SLIDES COM PROMPT POR SLIDE */}
      {slidesPrompts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{slidesPrompts.length} slides — edite prompts e gere imagens</CardTitle>
              <Button size="sm" onClick={gerarTodasImagens} disabled={imgLoading}>
                {imgLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wand2 className="h-3 w-3" /> Gerar todas imagens (Nano Banana)</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {slidesPrompts.map((s, i) => (
              <div key={i} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="text-[10px] flex-shrink-0">Slide {s.ordem}</Badge>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{s.titulo}</div>
                    <div className="text-xs text-muted-foreground">{s.texto}</div>
                  </div>
                  {slidesResults[i]?.url ? (
                    <div className="w-20 h-20 rounded overflow-hidden border border-border flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slidesResults[i].url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => gerarImagemSlide(i)} disabled={imgLoading}>
                      <ImageIcon className="h-3 w-3" /> Gerar
                    </Button>
                  )}
                </div>
                <div>
                  <Label className="text-[10px]">Prompt detalhado pra imagem deste slide (editável)</Label>
                  <Textarea className="mt-0.5 text-xs min-h-[50px]"
                    value={s.prompt_detalhe}
                    onChange={(e) => updateSlidePrompt(i, "prompt_detalhe", e.target.value)} />
                </div>
              </div>
            ))}

            {slidesResults.some((s) => s.url) && (
              <div className="border-t border-border pt-3">
                <div className="text-sm font-bold mb-2">Preview final</div>
                <div className="grid grid-cols-5 gap-2">
                  {slidesResults.filter((s) => s.url).map((s, i) => (
                    <div key={i} className="aspect-square rounded overflow-hidden border border-border relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url!} alt="" className="w-full h-full object-cover" />
                      <Badge className="absolute bottom-1 left-1 text-[9px]" variant="secondary">{s.ordem}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
