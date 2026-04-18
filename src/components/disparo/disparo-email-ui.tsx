"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Play, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Campanha { id: string; nome: string; status: string; total_emails: number; total_enviados: number; total_erros: number; created_at: string }
interface Lista { id: string; name: string }

export function DisparoEmailUI({ campanhas: initial, listas }: { campanhas: Campanha[]; listas: Lista[] }) {
  const [campanhas, setCampanhas] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [disparandoId, setDisparandoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "", lista_id: "",
    assunto_template: "",
    corpo_template: "",
  });

  const criar = async () => {
    if (!form.nome) return toast.error("Nome obrigatório");
    if (!form.lista_id) return toast.error("Selecione lista");
    setLoading(true);
    try {
      const r = await fetch("/api/disparo-email/campanhas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`Campanha criada — ${data.total_emails} emails`,
        `Leads com email: ${data.debug?.leads_com_email || 0}`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const disparar = async (id: string) => {
    setDisparandoId(id);
    try {
      const r = await fetch("/api/disparo-email/enviar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campanha_id: id }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`${data.enviados} enviados, ${data.erros} erros`);
      window.location.reload();
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setDisparandoId(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Nova campanha de email</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input className="mt-1" placeholder="Prospecção lojas SP"
              value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Lista de prospecção</Label>
              <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.lista_id} onChange={(e) => setForm({ ...form, lista_id: e.target.value })}>
                <option value="">Selecione</option>
                {listas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Assunto (opcional — se vazio, IA gera)</Label>
            <Input className="mt-1" placeholder="Ex: Ideia rápida pra {{empresa}}"
              value={form.assunto_template} onChange={(e) => setForm({ ...form, assunto_template: e.target.value })} /></div>
          <div><Label>Corpo do email (opcional — se vazio, IA gera personalizado)</Label>
            <Textarea className="mt-1 min-h-[100px]" placeholder="HTML simples. Use {{empresa}} pra personalizar."
              value={form.corpo_template} onChange={(e) => setForm({ ...form, corpo_template: e.target.value })} /></div>
          <div className="text-[10px] text-muted-foreground">
            Se deixar assunto e corpo vazios, IA gera email personalizado por lead (nome + segmento). Só leads com email cadastrado recebem.
          </div>
          <Button onClick={criar} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando emails com IA...</> : <><Sparkles className="h-4 w-4" /> Criar campanha + gerar emails</>}
          </Button>
        </CardContent>
      </Card>

      {campanhas.length > 0 && (
        <div className="space-y-2">
          {campanhas.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{c.nome}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.total_enviados}/{c.total_emails} enviados · {c.total_erros} erros
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "concluida" ? "success" : c.status === "ativa" ? "warning" : "secondary"}>
                    {c.status}
                  </Badge>
                  {c.status !== "concluida" && c.total_emails > 0 && (
                    <Button size="sm" onClick={() => disparar(c.id)} disabled={disparandoId !== null}>
                      {disparandoId === c.id ? <><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</> : <><Mail className="h-3 w-3" /> Disparar</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
