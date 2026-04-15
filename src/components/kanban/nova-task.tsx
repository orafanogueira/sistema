"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function NovaTaskButton({ boardId, columnId }: { boardId: string; columnId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "normal", due_date: "", tags: "",
  });

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titulo obrigatorio");
    setLoading(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardId,
          column_id: columnId,
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          due_date: form.due_date || null,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Tarefa criada");
      setOpen(false);
      setTimeout(() => window.location.reload(), 400);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(true)} title="Nova tarefa">
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,94vw)] bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Nova tarefa</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Titulo</Label>
                <Input className="mt-1" autoFocus value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Descricao (opcional)</Label>
                <Textarea className="mt-1" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prioridade</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div>
                  <Label>Prazo</Label>
                  <Input type="date" className="mt-1" value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Tags (separadas por virgula)</Label>
                <Input className="mt-1" placeholder="urgente, cliente-x" value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>

              <Button onClick={save} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar tarefa"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
