"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ConnectIgButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    cliente_id: "", ig_user_id: "", ig_username: "", fb_page_id: "", page_access_token: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/instagram-connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      setOpen(false);
      router.refresh();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline"><Instagram className="h-4 w-4" /> Conectar Instagram</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,92vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold">Conectar conta Instagram Business</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>

          <div className="text-xs text-muted-foreground mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <b>Requisitos:</b>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Conta Instagram convertida pra <b>Business</b> (perfil profissional)</li>
              <li>Conta conectada a uma <b>Page Facebook</b></li>
              <li>Meta App criado em developers.facebook.com com permissoes <code>instagram_manage_messages</code> + <code>pages_manage_metadata</code></li>
              <li>Page Access Token da Page (long-lived, via Graph API Explorer)</li>
            </ol>
            <p className="mt-2">Em breve: wizard de OAuth automatico. Por enquanto preenche manual.</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div><Label>Cliente *</Label>
              <select required className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">- selecione -</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div><Label>Instagram Business Account ID *</Label><Input required className="mt-1 font-mono text-xs" value={form.ig_user_id}
              onChange={(e) => setForm({ ...form, ig_user_id: e.target.value })} placeholder="17841400000000000" /></div>
            <div><Label>Username IG (@)</Label><Input className="mt-1" value={form.ig_username}
              onChange={(e) => setForm({ ...form, ig_username: e.target.value })} placeholder="athosmotors" /></div>
            <div><Label>Facebook Page ID *</Label><Input required className="mt-1 font-mono text-xs" value={form.fb_page_id}
              onChange={(e) => setForm({ ...form, fb_page_id: e.target.value })} placeholder="108xxxxxxxxxx" /></div>
            <div><Label>Page Access Token *</Label><Input required className="mt-1 font-mono text-xs" value={form.page_access_token}
              onChange={(e) => setForm({ ...form, page_access_token: e.target.value })} placeholder="EAAGxxxxxx..." /></div>

            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Conectando...</> : "Conectar"}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">Cancelar</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
