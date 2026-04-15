"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Video, X, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function EditorVideoButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roteiro, setRoteiro] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ briefing: "", duracao_seg: 30, plataforma: "instagram_reels" });

  const gerar = async () => {
    if (!form.briefing.trim()) return toast.error("Escreva o briefing");
    setLoading(true);
    setRoteiro("");
    try {
      const r = await fetch("/api/social/editor-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setRoteiro(data.roteiro);
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const copyIt = () => {
    navigator.clipboard.writeText(roteiro);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Video className="h-4 w-4" /> Editor video IA</Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(700px,94vw)] max-h-[92vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold flex items-center gap-2">
                <Video className="h-5 w-5 text-cyan" /> Editor de video IA
              </Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Briefing do video</Label>
                <Textarea className="mt-1 min-h-[120px]"
                  placeholder="Ex: video pra clinica odontologica promovendo limpeza dental por R$ 99, quero tom humorado mostrando antes/depois e convidando pra agendar pelo WhatsApp"
                  value={form.briefing} onChange={(e) => setForm({ ...form, briefing: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Duracao (segundos)</Label>
                  <Input type="number" className="mt-1" value={form.duracao_seg}
                    onChange={(e) => setForm({ ...form, duracao_seg: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Plataforma</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.target.value })}>
                    <option value="instagram_reels">Instagram Reels</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube_shorts">YouTube Shorts</option>
                    <option value="youtube_longo">YouTube (longo)</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
              </div>

              <Button onClick={gerar} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando roteiro completo...</> : <><Sparkles className="h-4 w-4" /> Gerar roteiro de edicao</>}
              </Button>

              {roteiro && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Roteiro</Label>
                    <Button size="sm" variant="outline" onClick={copyIt}>
                      {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
                    </Button>
                  </div>
                  <div className="p-3 bg-background/40 border border-border rounded whitespace-pre-wrap text-sm max-h-[500px] overflow-y-auto">
                    {roteiro}
                  </div>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
