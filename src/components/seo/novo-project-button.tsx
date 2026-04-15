"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function NovoSeoProjectButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    cliente_id: "", site_url: "", gmb_place_id: "", gsc_property: "", ga4_property_id: "",
    keywords_str: "", tom_de_voz: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const target_keywords = form.keywords_str.split(",").map((k) => k.trim()).filter(Boolean);
      const res = await fetch("/api/seo/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, target_keywords }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOpen(false);
      router.refresh();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button><Plus className="h-4 w-4" /> Novo projeto SEO</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold">Novo projeto SEO</Dialog.Title>
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
            <div><Label>URL do site *</Label><Input required className="mt-1" value={form.site_url}
              onChange={(e) => setForm({ ...form, site_url: e.target.value })} placeholder="https://athosmotors.com.br" /></div>
            <div><Label>Google My Business - Place ID</Label><Input className="mt-1" value={form.gmb_place_id}
              onChange={(e) => setForm({ ...form, gmb_place_id: e.target.value })} placeholder="opcional" /></div>
            <div><Label>Google Search Console - URL property</Label><Input className="mt-1" value={form.gsc_property}
              onChange={(e) => setForm({ ...form, gsc_property: e.target.value })} placeholder="sc-domain:athosmotors.com.br" /></div>
            <div><Label>GA4 Property ID</Label><Input className="mt-1" value={form.ga4_property_id}
              onChange={(e) => setForm({ ...form, ga4_property_id: e.target.value })} placeholder="opcional" /></div>
            <div><Label>Keywords alvo (separe por virgula)</Label><Input className="mt-1" value={form.keywords_str}
              onChange={(e) => setForm({ ...form, keywords_str: e.target.value })}
              placeholder="loja de carro sorocaba, onix usado" /></div>
            <div><Label>Tom de voz</Label><Input className="mt-1" value={form.tom_de_voz}
              onChange={(e) => setForm({ ...form, tom_de_voz: e.target.value })}
              placeholder="Profissional, direto, com calor humano" /></div>

            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : "Criar projeto"}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">Cancelar</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
