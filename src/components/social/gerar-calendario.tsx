"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Calendar, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function GerarCalendarioButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    cliente_id: "",
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    qtd_posts: 20,
    nicho: "",
    tom_de_voz: "",
    observacoes: "",
  });

  const gerar = async () => {
    if (!form.cliente_id) return toast.error("Selecione o cliente");
    setLoading(true);
    try {
      const r = await fetch("/api/social/calendario-ia", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`Calendário gerado!`, `${data.total_salvos} posts agendados automaticamente`);
      setOpen(false);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" /> Gerar calendário IA
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,94vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan" /> Gerar calendário editorial com IA
              </Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Cliente *</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Mês</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={form.mes} onChange={(e) => setForm({ ...form, mes: Number(e.target.value) })}>
                    {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input type="number" className="mt-1" value={form.ano}
                    onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Qtd posts</Label>
                  <Input type="number" min={5} max={30} className="mt-1" value={form.qtd_posts}
                    onChange={(e) => setForm({ ...form, qtd_posts: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label>Nicho/segmento (opcional)</Label>
                <Input className="mt-1" placeholder="Ex: barbearia, odontologia, automotivo"
                  value={form.nicho} onChange={(e) => setForm({ ...form, nicho: e.target.value })} />
              </div>

              <div>
                <Label>Tom de voz (opcional)</Label>
                <Input className="mt-1" placeholder="Ex: jovem e divertido, sério e profissional"
                  value={form.tom_de_voz} onChange={(e) => setForm({ ...form, tom_de_voz: e.target.value })} />
              </div>

              <div>
                <Label>Observações (opcional)</Label>
                <Textarea className="mt-1" placeholder="Ex: promoção especial dia 20, inauguração nova unidade..."
                  value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>

              <div className="bg-cyan/5 border border-cyan/30 rounded p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">O que a IA gera:</div>
                <div>• {form.qtd_posts} posts distribuídos no mês com datas e horários ideais</div>
                <div>• Mix de formatos: feed (40%), carrossel (25%), reels (25%), stories (10%)</div>
                <div>• Pilares: autoridade, educativo, bastidores, venda, engajamento</div>
                <div>• Cada post com título (hook), briefing e hashtags</div>
                <div>• Considera feriados e datas comemorativas</div>
              </div>

              <Button onClick={gerar} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando calendário (~30s)...</> : <><Sparkles className="h-4 w-4" /> Gerar {form.qtd_posts} posts</>}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
