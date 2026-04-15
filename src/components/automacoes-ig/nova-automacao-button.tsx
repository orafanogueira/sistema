"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

interface Conta { id: string; ig_username: string | null; cliente_id: string | null; cliente: { nome?: string } | null; }

export function NovaAutomacaoIgButton({ clientes, contas }: { clientes: { id: string; nome: string }[]; contas: Conta[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    cliente_id: "",
    ig_account_id: "",
    name: "",
    keywords_str: "",
    response_text: "Oi {{nome}}! 🙌 Bem-vindo! Aqui esta o que voce pediu: [COLOQUE O LINK OU MATERIAL AQUI]",
    public_reply_text: "Mandei no seu direct! 📩 Da uma olhada na sua caixa de mensagens.",
    send_public_reply: true,
    one_per_user: true,
    create_lead: true,
    only_followers: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const keywords = form.keywords_str.split(",").map((k) => k.trim()).filter(Boolean);
      if (!keywords.length) throw new Error("Adicione ao menos 1 palavra-chave");
      const r = await fetch("/api/automacoes-ig", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: form.cliente_id,
          ig_account_id: form.ig_account_id,
          name: form.name,
          keywords,
          response_text: form.response_text,
          public_reply_text: form.send_public_reply ? form.public_reply_text : null,
          send_public_reply: form.send_public_reply,
          one_per_user: form.one_per_user,
          create_lead: form.create_lead,
          only_followers: form.only_followers,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setOpen(false);
      router.refresh();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  };

  const contasFiltered = form.cliente_id ? contas.filter((c) => c.cliente_id === form.cliente_id) : contas;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button disabled={contas.length === 0}><Plus className="h-4 w-4" /> Nova automacao</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,92vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-bold">Nova automacao Instagram</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <select required className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value, ig_account_id: "" })}>
                <option value="">- selecione -</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <Label>Conta Instagram *</Label>
              <select required className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.ig_account_id} onChange={(e) => setForm({ ...form, ig_account_id: e.target.value })}>
                <option value="">- selecione -</option>
                {contasFiltered.map((c) => <option key={c.id} value={c.id}>@{c.ig_username}</option>)}
              </select>
            </div>
            <div><Label>Nome da automacao *</Label><Input required className="mt-1" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Lancamento curso - comente QUERO" /></div>

            <div>
              <Label>Palavras-chave * (separe por virgula)</Label>
              <Input required className="mt-1" value={form.keywords_str}
                onChange={(e) => setForm({ ...form, keywords_str: e.target.value })}
                placeholder="quero, info, link, material, ebook" />
              <div className="text-[11px] text-muted-foreground mt-1">Se o comentario contem qualquer uma dessas palavras, a automacao dispara.</div>
            </div>

            <div>
              <Label>Mensagem que vai pro DM *</Label>
              <Textarea required className="mt-1" rows={4} value={form.response_text}
                onChange={(e) => setForm({ ...form, response_text: e.target.value })} />
              <div className="text-[11px] text-muted-foreground mt-1">Use <code>{"{{nome}}"}</code> pra incluir o username.</div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.send_public_reply}
                  onChange={(e) => setForm({ ...form, send_public_reply: e.target.checked })} />
                Tambem responder publicamente no comentario
              </label>
              {form.send_public_reply && (
                <Input className="ml-6" value={form.public_reply_text}
                  onChange={(e) => setForm({ ...form, public_reply_text: e.target.value })}
                  placeholder="Mandei no seu direct! 📩" />
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.one_per_user}
                  onChange={(e) => setForm({ ...form, one_per_user: e.target.checked })} />
                Enviar apenas 1 vez por usuario (evita spam)
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.create_lead}
                  onChange={(e) => setForm({ ...form, create_lead: e.target.checked })} />
                Criar lead no CRM automaticamente
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.only_followers}
                  onChange={(e) => setForm({ ...form, only_followers: e.target.checked })} />
                Enviar apenas se for seguidor (em breve)
              </label>
            </div>

            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : "Criar automacao"}
              </Button>
              <Dialog.Close asChild><Button type="button" variant="ghost">Cancelar</Button></Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
