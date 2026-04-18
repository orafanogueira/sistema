"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Youtube, Plug, Check, Upload, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { Input, Label, Textarea } from "@/components/ui/input";

export function ConectarYouTubeButton() {
  const [connected, setConnected] = useState(false);
  const [channelName, setChannelName] = useState("");

  useEffect(() => {
    // checa se já tá conectado
    fetch("/api/youtube/canais-minerados").catch(() => {});
    // checa URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success("YouTube conectado!");
      setConnected(true);
    }
    if (params.get("error")) {
      toast.error("Erro ao conectar YouTube", params.get("error") || "");
    }
  }, []);

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="success" className="flex items-center gap-1">
          <Check className="h-3 w-3" /> YouTube conectado {channelName && `— ${channelName}`}
        </Badge>
      </div>
    );
  }

  return (
    <a href="/api/youtube/oauth">
      <Button variant="outline" size="sm">
        <Youtube className="h-4 w-4 text-red-500" /> Conectar canal YouTube
      </Button>
    </a>
  );
}

export function PostarYouTubeButton({ videoUrl }: { videoUrl: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    privacy: "private" as "private" | "unlisted" | "public",
    category_id: "22",
    scheduled_at: "",
  });
  const [result, setResult] = useState<{ youtube_url?: string } | null>(null);

  const postar = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    setLoading(true);
    try {
      const r = await fetch("/api/youtube/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, ...form }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setResult(data);
      toast.success("Vídeo postado no YouTube!", data.youtube_url);
    } catch (e: unknown) {
      toast.error("Erro upload", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  if (result?.youtube_url) {
    return (
      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded space-y-2">
        <div className="text-sm font-bold text-green-400 flex items-center gap-2">
          <Check className="h-4 w-4" /> Vídeo no YouTube!
        </div>
        <a href={result.youtube_url} target="_blank" rel="noopener" className="text-cyan text-sm hover:underline">
          {result.youtube_url}
        </a>
      </div>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full">
        <Upload className="h-4 w-4" /> Postar no YouTube
      </Button>
    );
  }

  return (
    <div className="border border-cyan/30 bg-cyan/5 rounded p-3 space-y-2">
      <div className="text-sm font-bold">Postar no YouTube</div>
      <div>
        <Label>Título *</Label>
        <Input className="mt-1" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea className="mt-1 min-h-[80px]" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Tags (separadas por vírgula)</Label>
          <Input className="mt-1" value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </div>
        <div>
          <Label>Privacidade</Label>
          <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
            value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value as "private" | "unlisted" | "public" })}>
            <option value="private">Privado</option>
            <option value="unlisted">Não listado</option>
            <option value="public">Público</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Agendar publicação (opcional)</Label>
        <Input type="datetime-local" className="mt-1" value={form.scheduled_at}
          onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
      </div>
      <Button onClick={postar} disabled={loading} className="w-full">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando pro YouTube...</> : <><Youtube className="h-4 w-4" /> Postar</>}
      </Button>
    </div>
  );
}
