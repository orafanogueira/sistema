"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { UserPlus, X, Loader2, Copy, Check } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function ConvidarMembroButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: "", role: "readonly", team: "" });

  const save = async () => {
    if (!form.email.trim()) return toast.error("Email obrigatorio");
    setLoading(true);
    setLink(null);
    try {
      const r = await fetch("/api/team-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, role: form.role, team: form.team || null }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const base = window.location.origin;
      setLink(`${base}/convite/${data.token}`);
      toast.success("Convite criado", "Envie o link pra pessoa");
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Convidar</Button>

      <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setLink(null); setForm({ email: "", role: "readonly", team: "" }); } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,94vw)] bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Convidar membro</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" placeholder="pessoa@empresa.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Cargo / Role</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="readonly">Somente leitura</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <Label>Time (opcional)</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                  <option value="">Sem time especifico</option>
                  <option value="trafego">Trafego</option>
                  <option value="social">Social</option>
                  <option value="video">Video</option>
                  <option value="comercial">Comercial</option>
                </select>
              </div>

              {link ? (
                <div className="p-3 bg-cyan/10 border border-cyan/30 rounded space-y-2">
                  <div className="text-xs text-muted-foreground">Link de convite (valido por 14 dias):</div>
                  <div className="font-mono text-xs break-all">{link}</div>
                  <Button size="sm" onClick={copy} className="w-full">
                    {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar link</>}
                  </Button>
                </div>
              ) : (
                <Button onClick={save} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar convite"}
                </Button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
