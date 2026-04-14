"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/utils";

export function NovoClienteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "", segmento: "", contato_nome: "", contato_email: "", contato_whatsapp: "",
    ticket_mensal: "", vencimento: "", status: "ativo", observacoes: "",
  });

  const onChange = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/clientes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, slug: slugify(form.nome), ticket_mensal: Number(form.ticket_mensal || 0), vencimento: Number(form.vencimento || 0) }),
    });
    setLoading(false);
    if (res.ok) { setOpen(false); router.refresh(); }
    else alert("Erro: " + await res.text());
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button><Plus className="h-4 w-4" /> Novo cliente</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold">Novo cliente</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nome do cliente *</Label><Input required className="mt-1" value={form.nome} onChange={(e) => onChange("nome", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Segmento</Label><Input className="mt-1" value={form.segmento} onChange={(e) => onChange("segmento", e.target.value)} placeholder="Ex: Clinica odontologica" /></div>
              <div><Label>Status</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm" value={form.status} onChange={(e) => onChange("status", e.target.value)}>
                  <option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="prospect">Prospect</option><option value="encerrado">Encerrado</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contato nome</Label><Input className="mt-1" value={form.contato_nome} onChange={(e) => onChange("contato_nome", e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input className="mt-1" value={form.contato_whatsapp} onChange={(e) => onChange("contato_whatsapp", e.target.value)} placeholder="5511999999999" /></div>
            </div>
            <div><Label>Email</Label><Input type="email" className="mt-1" value={form.contato_email} onChange={(e) => onChange("contato_email", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ticket mensal (R$)</Label><Input type="number" step="0.01" className="mt-1" value={form.ticket_mensal} onChange={(e) => onChange("ticket_mensal", e.target.value)} /></div>
              <div><Label>Dia de vencimento</Label><Input type="number" min="1" max="31" className="mt-1" value={form.vencimento} onChange={(e) => onChange("vencimento", e.target.value)} /></div>
            </div>
            <div><Label>Observacoes</Label><Textarea className="mt-1" value={form.observacoes} onChange={(e) => onChange("observacoes", e.target.value)} /></div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Criar cliente"}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">Cancelar</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
