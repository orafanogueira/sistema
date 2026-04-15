"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function NovaOfertaMaxxima() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "", nicho: "", publico_alvo: "", dor_principal: "", promessa: "",
    preco: "", anuncios_ativos_dias: "", google_trends_score: "", volume_busca: "",
    concorrentes_str: "", meta_library_urls_str: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const payload = {
        nome: form.nome, nicho: form.nicho, publico_alvo: form.publico_alvo,
        dor_principal: form.dor_principal, promessa: form.promessa,
        preco: form.preco ? Number(form.preco) : null,
        anuncios_ativos_dias: form.anuncios_ativos_dias ? Number(form.anuncios_ativos_dias) : null,
        google_trends_score: form.google_trends_score ? Number(form.google_trends_score) : null,
        volume_busca: form.volume_busca ? Number(form.volume_busca) : null,
        concorrentes: form.concorrentes_str.split(",").map((c) => c.trim()).filter(Boolean),
        meta_library_urls: form.meta_library_urls_str.split("\n").map((c) => c.trim()).filter(Boolean),
      };
      const r = await fetch("/api/maxxima/ofertas", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      setOpen(false);
      router.refresh();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button><Plus className="h-4 w-4" /> Nova oferta</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,92vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold">Nova oferta Maxxima</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nome da oferta *</Label><Input required value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Curso Secret Money" /></div>
            <div><Label>Nicho *</Label><Input required value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value })} placeholder="financas pessoais, trafego pago, etc" /></div>
            <div><Label>Publico</Label><Input value={form.publico_alvo}
              onChange={(e) => setForm({ ...form, publico_alvo: e.target.value })} /></div>
            <div><Label>Dor principal</Label><Input value={form.dor_principal}
              onChange={(e) => setForm({ ...form, dor_principal: e.target.value })} /></div>
            <div><Label>Promessa</Label><Input value={form.promessa}
              onChange={(e) => setForm({ ...form, promessa: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Preco (R$)</Label><Input type="number" value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })} /></div>
              <div><Label>Anuncios ativos (dias)</Label><Input type="number" value={form.anuncios_ativos_dias}
                onChange={(e) => setForm({ ...form, anuncios_ativos_dias: e.target.value })}
                placeholder="Do concorrente" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Google Trends (0-100)</Label><Input type="number" min="0" max="100" value={form.google_trends_score}
                onChange={(e) => setForm({ ...form, google_trends_score: e.target.value })} /></div>
              <div><Label>Volume busca/mes</Label><Input type="number" value={form.volume_busca}
                onChange={(e) => setForm({ ...form, volume_busca: e.target.value })} /></div>
            </div>
            <div><Label>Concorrentes (separe por virgula)</Label><Input value={form.concorrentes_str}
              onChange={(e) => setForm({ ...form, concorrentes_str: e.target.value })}
              placeholder="@kathybartz, @ricardomaxxima" /></div>
            <div><Label>URLs Meta Library (1 por linha)</Label><Textarea rows={2} value={form.meta_library_urls_str}
              onChange={(e) => setForm({ ...form, meta_library_urls_str: e.target.value })} /></div>

            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Validando...</> : "Criar + validar"}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">Cancelar</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
