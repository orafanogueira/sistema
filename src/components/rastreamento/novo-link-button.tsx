"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function NovoLinkButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    cliente_id: "",
    name: "",
    slug: "",
    destination_url: "",
    default_message: "",
    campaign_ref: "",
  });
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      // Monta URL final com mensagem pre-preenchida se for WhatsApp
      let dest = form.destination_url.trim();
      if (dest.includes("wa.me") && form.default_message) {
        const u = new URL(dest);
        u.searchParams.set("text", form.default_message);
        dest = u.toString();
      }
      const res = await fetch("/api/short-links", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, destination_url: dest }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOpen(false);
      router.refresh();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button><Plus className="h-4 w-4" /> Novo link</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)] bg-card border border-border rounded-xl p-6 z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold">Novo link rastreavel</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Cliente *</Label>
              <select required className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">- selecione -</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><Label>Nome do link *</Label><Input className="mt-1" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: site-home-botao-whatsapp" /></div>
            <div><Label>Slug personalizado (opcional)</Label><Input className="mt-1" value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="deixe vazio pra gerar automatico" /></div>
            <div><Label>URL de destino *</Label><Input className="mt-1" required value={form.destination_url}
              onChange={(e) => setForm({ ...form, destination_url: e.target.value })} placeholder="https://wa.me/5511999999999" /></div>
            <div><Label>Mensagem pre-preenchida (WhatsApp)</Label><Input className="mt-1" value={form.default_message}
              onChange={(e) => setForm({ ...form, default_message: e.target.value })} placeholder="Ola, vi seu anuncio e quero mais info" /></div>
            <div><Label>Ref da campanha (opcional)</Label><Input className="mt-1" value={form.campaign_ref}
              onChange={(e) => setForm({ ...form, campaign_ref: e.target.value })} placeholder="Ex: lancamento-abril-2026" /></div>

            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : "Criar link"}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">Cancelar</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
