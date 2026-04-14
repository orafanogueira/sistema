"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";

const PRESETS = {
  automotivo: {
    name: "Jornada Automotivo",
    etapas: [
      { name: "Primeiro contato", color: "#64748b", position: 0, meta_event: "Contact",
        keywords: ["ola","oi","bom dia","boa tarde","boa noite","tenho interesse","quero saber"] },
      { name: "Qualificacao", color: "#00c8e0", position: 1, meta_event: "Lead",
        keywords: ["a vista","financiamento","troca","parcelado","entrada","simulacao"] },
      { name: "Visita agendada", color: "#0055cc", position: 2, meta_event: "Schedule", google_conversion_name: "Agendamento",
        keywords: ["agendar","marcar visita","ir na loja","amanha","hoje","sabado","domingo","segunda","terca","quarta","quinta","sexta","que horas"] },
      { name: "Proposta enviada", color: "#a855f7", position: 3,
        keywords: ["proposta","contraproposta","consigo","aceito","topo"] },
      { name: "Negociacao", color: "#f59e0b", position: 4,
        keywords: ["desconto","abaixo","melhor preco","diminuir"] },
      { name: "Venda fechada", color: "#22c55e", position: 5, is_won: true, is_sale: true,
        meta_event: "Purchase", google_conversion_name: "Venda",
        keywords: ["parabens","fechado","vendido","adquirir","compra","negocio fechado","levar o carro"] },
      { name: "Perdido", color: "#ef4444", position: 6, is_lost: true,
        keywords: ["vou pensar","desisti","nao da","muito caro","achei outro"] },
    ],
  },
  comercial: {
    name: "Jornada Comercial",
    etapas: [
      { name: "Primeiro contato", color: "#64748b", position: 0, meta_event: "Contact", keywords: ["ola","oi","bom dia","boa tarde"] },
      { name: "Qualificado", color: "#00c8e0", position: 1, meta_event: "Lead", keywords: ["orcamento","proposta","valor","quanto custa"] },
      { name: "Proposta", color: "#a855f7", position: 2, meta_event: "InitiateCheckout", keywords: ["enviei a proposta","segue orcamento"] },
      { name: "Vendido", color: "#22c55e", position: 3, is_won: true, is_sale: true, meta_event: "Purchase",
        keywords: ["parabens","fechado","aceito","vamos fazer"] },
      { name: "Perdido", color: "#ef4444", position: 4, is_lost: true, keywords: ["nao tenho interesse","desisto"] },
    ],
  },
  agencia: {
    name: "Jornada Comercial - Agencia",
    etapas: [
      { name: "Lead novo", color: "#64748b", position: 0, meta_event: "Contact", keywords: ["ola","oi"] },
      { name: "Qualificado", color: "#00c8e0", position: 1, meta_event: "Lead", keywords: ["orcamento","reuniao","call"] },
      { name: "Proposta", color: "#a855f7", position: 2, meta_event: "InitiateCheckout", keywords: ["proposta enviada"] },
      { name: "Fechado", color: "#22c55e", position: 3, is_won: true, is_sale: true, meta_event: "Purchase",
        keywords: ["fechou","contrato","pagamento"] },
    ],
  },
};

export function CriarJornadaPadraoButton({ clientes }: { clientes: { id: string; nome: string; vertical?: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cliente, setCliente] = useState("");
  const [preset, setPreset] = useState<"automotivo" | "comercial" | "agencia">("automotivo");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const p = PRESETS[preset];
      const res = await fetch("/api/jornadas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: cliente, name: p.name, is_default: true,
          etapas: p.etapas.map((e) => ({
            ...e,
            keywords: (e.keywords || []).map((pat) => ({ pattern: pat, direction: "in" })),
          })),
        }),
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
        <Button><Plus className="h-4 w-4" /> Criar jornada padrao</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,92vw)] bg-card border border-border rounded-xl p-6 z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold">Criar jornada padrao</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Cliente *</Label>
              <select required className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={cliente} onChange={(e) => setCliente(e.target.value)}>
                <option value="">- selecione -</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.vertical ? ` (${c.vertical})` : ""}</option>)}
              </select>
            </div>
            <div><Label>Template *</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={preset} onChange={(e) => setPreset(e.target.value as "automotivo" | "comercial" | "agencia")}>
                <option value="automotivo">🚗 Automotivo (lojas de carro)</option>
                <option value="comercial">🤝 Comercial (servicos, clinicas)</option>
                <option value="agencia">💼 Agencia (B2B)</option>
              </select>
              <div className="text-[11px] text-muted-foreground mt-1">{PRESETS[preset].etapas.length} etapas pre-configuradas com palavras-chave e eventos Meta.</div>
            </div>
            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : "Criar jornada"}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">Cancelar</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
