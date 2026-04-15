"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function NovoBoardButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", scope: "tenant", team: "", cliente_id: "" });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatorio");
    setLoading(true);
    try {
      const r = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          scope: form.scope,
          team: form.team || null,
          cliente_id: form.cliente_id || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success("Board criado");
      setOpen(false);
      setTimeout(() => { window.location.href = `/kanban?board=${data.id}`; }, 400);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo board</Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,94vw)] bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Novo board Kanban</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input className="mt-1" placeholder="Ex: Tarefas da equipe de trafego"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <Label>Escopo</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                  <option value="tenant">Agencia (todos)</option>
                  <option value="team">Time especifico</option>
                  <option value="cliente">Cliente especifico</option>
                  <option value="personal">Pessoal</option>
                </select>
              </div>

              {form.scope === "team" && (
                <div>
                  <Label>Time</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                    <option value="">Selecione</option>
                    <option value="trafego">Trafego</option>
                    <option value="social">Social</option>
                    <option value="video">Video</option>
                    <option value="comercial">Comercial</option>
                  </select>
                </div>
              )}

              {form.scope === "cliente" && (
                <div>
                  <Label>Cliente</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                    <option value="">Selecione</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Sera criado com 4 colunas padrao: A fazer → Em andamento → Revisao → Concluido
              </div>

              <Button onClick={save} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar board"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
