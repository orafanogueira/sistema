"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Plus, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const TRIGGERS = [
  { value: "lead_created", label: "Lead novo capturado" },
  { value: "lead_stage_changed", label: "Lead muda de estagio" },
  { value: "lead_assigned", label: "Vendedor atribuido" },
  { value: "lead_idle", label: "Lead inativo (X horas)" },
  { value: "message_received", label: "Mensagem recebida" },
  { value: "no_response_from_seller", label: "Vendedor nao respondeu (X min)" },
  { value: "sla_breach", label: "SLA estourado" },
  { value: "tag_added", label: "Tag adicionada" },
];
const ACTIONS = [
  { value: "send_message_whatsapp", label: "Enviar WhatsApp" },
  { value: "send_email", label: "Enviar email" },
  { value: "create_task", label: "Criar tarefa" },
  { value: "move_stage", label: "Mover de estagio" },
  { value: "assign_round_robin", label: "Distribuir vendedor (round-robin)" },
  { value: "add_tag", label: "Adicionar tag" },
  { value: "notify_user", label: "Notificar usuario" },
  { value: "run_ai_response", label: "Rodar resposta IA" },
];

interface ActionDraft { type: string; template?: string; tag?: string; minutes?: number }

export function NovaAutomacaoButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger: "lead_created",
    trigger_minutes: 60,
    cliente_id: "",
  });
  const [actions, setActions] = useState<ActionDraft[]>([{ type: "send_message_whatsapp", template: "" }]);

  const addAction = () => setActions([...actions, { type: "send_message_whatsapp", template: "" }]);
  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, patch: Partial<ActionDraft>) =>
    setActions(actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatorio");
    setLoading(true);
    try {
      const needsMinutes = form.trigger === "lead_idle" || form.trigger === "no_response_from_seller";
      const r = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          trigger: form.trigger,
          trigger_config: needsMinutes ? { minutes: form.trigger_minutes } : {},
          cliente_id: form.cliente_id || null,
          actions: actions.filter((a) => a.type),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Automacao criada", "Agora e ativar e deixar rodar");
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
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova automacao</Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(640px,94vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Nova automacao</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input className="mt-1" placeholder="Ex: Boas-vindas lead novo"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <Label>Cliente (opcional)</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">Todos os clientes</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <Label>Quando (gatilho)</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
                  {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {(form.trigger === "lead_idle" || form.trigger === "no_response_from_seller") && (
                <div>
                  <Label>Minutos</Label>
                  <Input type="number" className="mt-1" value={form.trigger_minutes}
                    onChange={(e) => setForm({ ...form, trigger_minutes: Number(e.target.value) })} />
                </div>
              )}

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <Label>Acoes (em ordem)</Label>
                  <Button size="sm" variant="outline" onClick={addAction}><Plus className="h-3 w-3" /> Acao</Button>
                </div>
                <div className="space-y-2">
                  {actions.map((a, i) => (
                    <div key={i} className="border border-border rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select className="flex-1 flex h-9 rounded-md border border-input bg-background/40 px-3 text-sm"
                          value={a.type} onChange={(e) => updateAction(i, { type: e.target.value })}>
                          {ACTIONS.map((ac) => <option key={ac.value} value={ac.value}>{ac.label}</option>)}
                        </select>
                        <Button variant="ghost" size="icon" onClick={() => removeAction(i)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      {(a.type === "send_message_whatsapp" || a.type === "send_email") && (
                        <Textarea placeholder="Mensagem (use {{nome}}, {{telefone}}, {{cliente}})"
                          value={a.template || ""} onChange={(e) => updateAction(i, { template: e.target.value })} />
                      )}
                      {(a.type === "add_tag") && (
                        <Input placeholder="Nome da tag" value={a.tag || ""}
                          onChange={(e) => updateAction(i, { tag: e.target.value })} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={save} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar automacao"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
