"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Agent {
  id: string;
  name: string;
  persona: string | null;
  system_prompt: string | null;
  model: string;
  channels: string[] | null;
  is_active: boolean;
  cliente_id: string | null;
}

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram DM" },
  { value: "messenger", label: "Messenger" },
];

export function AgenteEditor({ agent, clientes }: { agent: Agent; clientes: { id: string; nome: string }[] }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: agent.name || "",
    persona: agent.persona || "",
    system_prompt: agent.system_prompt || agent.persona || "",
    model: agent.model || "claude-sonnet-4-5",
    channels: agent.channels || ["whatsapp"],
    is_active: agent.is_active,
    cliente_id: agent.cliente_id || "",
  });

  const toggleChannel = (ch: string) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));

  const save = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ai-agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, ...form, cliente_id: form.cliente_id || null }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Agente atualizado");
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Configuracao</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Nome</Label>
          <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div>
          <Label>Cliente</Label>
          <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
            value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
            <option value="">Interno (agencia)</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div>
          <Label>Persona / system prompt</Label>
          <Textarea className="mt-1 min-h-[220px] font-mono text-xs"
            value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value, persona: e.target.value })} />
          <div className="text-xs text-muted-foreground mt-1">
            Tudo que o agente "sabe" e "deve fazer". Use {"{{nome}}"}, {"{{cliente}}"} como placeholders.
          </div>
        </div>

        <div>
          <Label>Modelo</Label>
          <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
            value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
            <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (recomendado)</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rapido/barato)</option>
            <option value="claude-opus-4-6">Claude Opus 4.6 (maximo)</option>
          </select>
        </div>

        <div>
          <Label>Canais</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {CHANNELS.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer border border-border rounded-md px-3 py-2">
                <input type="checkbox" checked={form.channels.includes(c.value)} onChange={() => toggleChannel(c.value)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_active" checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          <Label htmlFor="is_active">Ativo</Label>
        </div>

        <Button onClick={save} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Salvar</>}
        </Button>
      </CardContent>
    </Card>
  );
}
