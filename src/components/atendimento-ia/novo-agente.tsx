"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram DM" },
  { value: "messenger", label: "Messenger" },
];

export function NovoAgenteButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    persona: "",
    model: "claude-sonnet-4-5",
    cliente_id: "",
    channels: ["whatsapp"] as string[],
  });

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatorio");
    if (!form.persona.trim()) return toast.error("Persona obrigatoria", "Explique como o agente deve agir");
    if (form.channels.length === 0) return toast.error("Selecione ao menos 1 canal");
    setLoading(true);
    try {
      const r = await fetch("/api/ai-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cliente_id: form.cliente_id || null,
          system_prompt: form.persona,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Agente criado");
      setOpen(false);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo agente</Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,94vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Novo agente IA</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Nome do agente</Label>
                <Input className="mt-1" placeholder="Ex: Ana SDR"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <Label>Cliente (opcional)</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">Interno (agencia)</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <Label>Persona / instrucoes</Label>
                <Textarea className="mt-1 min-h-[140px]"
                  placeholder="Voce e a Ana, SDR da empresa X. Seu objetivo e qualificar o lead perguntando: 1) nome, 2) necessidade, 3) prazo. Sempre seja cordial e objetiva."
                  value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} />
              </div>

              <div>
                <Label>Modelo</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
                  <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (recomendado)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rapido)</option>
                  <option value="claude-opus-4-6">Claude Opus 4.6 (maximo)</option>
                </select>
              </div>

              <div>
                <Label>Canais</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CHANNELS.map((c) => (
                    <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer border border-border rounded-md px-3 py-2">
                      <input type="checkbox" checked={form.channels.includes(c.value)}
                        onChange={() => toggleChannel(c.value)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={save} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar agente"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
