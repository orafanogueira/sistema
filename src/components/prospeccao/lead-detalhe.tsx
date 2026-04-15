"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { X, Loader2, Phone, MessageCircle, Globe, Star, MapPin, Mail, Calendar, Save, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Lead {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  whatsapp: string | null;
  website: string | null;
  email: string | null;
  categoria: string | null;
  rating: number | null;
  reviews_count: number | null;
  google_maps_url: string | null;
  status: string;
  notas: string | null;
}

const STATUS_OPTS = [
  { value: "novo", label: "Novo" },
  { value: "contato_feito", label: "Contato feito" },
  { value: "agendado", label: "Agendado" },
  { value: "reuniao_realizada", label: "Reuniao realizada" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
  { value: "sem_interesse", label: "Sem interesse" },
];

const RESULTADOS = [
  { value: "atendeu", label: "Atendeu" },
  { value: "nao_atendeu", label: "Nao atendeu" },
  { value: "caixa_postal", label: "Caixa postal" },
  { value: "agendou", label: "Agendou reuniao" },
  { value: "nao_tem_interesse", label: "Nao tem interesse" },
  { value: "pediu_retorno", label: "Pediu retorno" },
  { value: "conseguiu_email", label: "Conseguiu email" },
  { value: "enviou_proposta", label: "Enviou proposta" },
];

export function LeadDetalheDialog({ lead, onClose, onUpdate }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (patch: Partial<Lead>) => void;
}) {
  const [tab, setTab] = useState<"info" | "atividade" | "agendar" | "ia">("info");
  const [loading, setLoading] = useState(false);

  // IA tab state
  const [iaLoading, setIaLoading] = useState(false);
  const [iaTipo, setIaTipo] = useState<"script" | "whatsapp">("script");
  const [iaOutput, setIaOutput] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const gerarIA = async () => {
    setIaLoading(true);
    setIaOutput("");
    try {
      const endpoint = iaTipo === "script" ? "script-ligacao" : "mensagem-whatsapp";
      const r = await fetch(`/api/prospeccao/agentes/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setIaOutput(iaTipo === "script" ? data.script : data.mensagens);
    } catch (e: unknown) {
      toast.error("Erro IA", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setIaLoading(false);
    }
  };

  const copyIA = () => {
    if (!iaOutput) return;
    navigator.clipboard.writeText(iaOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Info tab state
  const [info, setInfo] = useState({
    email: lead.email || "",
    notas: lead.notas || "",
    status: lead.status,
  });

  // Atividade tab state
  const [atv, setAtv] = useState({
    tipo: "ligacao",
    resultado: "atendeu",
    duracao_seg: 0,
    notas: "",
    proximo_passo: "",
    proximo_contato_at: "",
    novo_status: lead.status,
  });

  // Agendar tab state
  const [ag, setAg] = useState({
    titulo: `Reuniao com ${lead.nome}`,
    data_reuniao: "",
    hora: "09:00",
    duracao_min: 30,
    link_reuniao: "",
    notas: "",
  });

  const saveInfo = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/prospeccao/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Lead atualizado");
      onUpdate(info);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  const saveAtividade = async () => {
    if (!atv.notas && atv.tipo !== "ligacao") return toast.error("Registre uma nota");
    setLoading(true);
    try {
      const r = await fetch("/api/prospeccao/atividades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...atv, lead_id: lead.id }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Atividade registrada");
      onUpdate({ status: atv.novo_status });
      setTimeout(() => window.location.reload(), 400);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  const saveAgendamento = async () => {
    if (!ag.data_reuniao) return toast.error("Escolha data e hora");
    setLoading(true);
    try {
      const dt = new Date(`${ag.data_reuniao}T${ag.hora}:00`).toISOString();
      const r = await fetch("/api/prospeccao/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          titulo: ag.titulo,
          data_reuniao: dt,
          duracao_min: ag.duracao_min,
          link_reuniao: ag.link_reuniao || null,
          notas: ag.notas || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Reuniao agendada", "Lead movido pra 'Agendado'");
      onUpdate({ status: "agendado" });
      setTimeout(() => window.location.reload(), 400);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(640px,94vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
          <div className="flex items-start justify-between mb-4 gap-4">
            <div className="flex-1">
              <Dialog.Title className="text-xl font-bold">{lead.nome}</Dialog.Title>
              {lead.categoria && <div className="text-sm text-muted-foreground mt-1">{lead.categoria}</div>}
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
          </div>

          {/* Dados do Google */}
          <div className="space-y-1 text-sm mb-4 pb-4 border-b border-border">
            {lead.endereco && (
              <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" /><span>{lead.endereco}</span></div>
            )}
            {lead.telefone && (
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`tel:${lead.telefone.replace(/\D/g, "")}`} className="text-cyan hover:underline">{lead.telefone}</a>
              </div>
            )}
            {lead.whatsapp && (
              <div className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener" className="text-cyan hover:underline">{lead.whatsapp}</a>
              </div>
            )}
            {lead.website && (
              <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={lead.website} target="_blank" rel="noopener" className="text-cyan hover:underline truncate">{lead.website}</a>
              </div>
            )}
            {lead.rating && (
              <div className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                <span>{lead.rating} ({lead.reviews_count} reviews no Google)</span>
              </div>
            )}
            {lead.google_maps_url && (
              <a href={lead.google_maps_url} target="_blank" rel="noopener" className="text-xs text-cyan hover:underline">Ver no Google Maps →</a>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
            {(["info", "atividade", "agendar", "ia"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${tab === t ? "border-cyan text-cyan" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t === "info" && "Info"}
                {t === "atividade" && "Registrar atividade"}
                {t === "agendar" && "Agendar reuniao"}
                {t === "ia" && <><Sparkles className="h-3 w-3" /> IA</>}
              </button>
            ))}
          </div>

          {tab === "info" && (
            <div className="space-y-3">
              <div>
                <Label>Email (descoberto)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })}
                    placeholder="Adicione depois que descobrir" />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value })}>
                  {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Notas gerais</Label>
                <Textarea className="mt-1" value={info.notas} onChange={(e) => setInfo({ ...info, notas: e.target.value })} />
              </div>
              <Button onClick={saveInfo} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Salvar</>}
              </Button>
            </div>
          )}

          {tab === "atividade" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={atv.tipo} onChange={(e) => setAtv({ ...atv, tipo: e.target.value })}>
                    <option value="ligacao">Ligacao</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="visita">Visita</option>
                    <option value="nota">Nota</option>
                  </select>
                </div>
                <div>
                  <Label>Resultado</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={atv.resultado} onChange={(e) => setAtv({ ...atv, resultado: e.target.value })}>
                    {RESULTADOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {atv.tipo === "ligacao" && (
                <div>
                  <Label>Duracao (segundos)</Label>
                  <Input type="number" className="mt-1" value={atv.duracao_seg}
                    onChange={(e) => setAtv({ ...atv, duracao_seg: Number(e.target.value) })} />
                </div>
              )}

              <div>
                <Label>Notas</Label>
                <Textarea className="mt-1" placeholder="O que o cliente falou?"
                  value={atv.notas} onChange={(e) => setAtv({ ...atv, notas: e.target.value })} />
              </div>

              <div>
                <Label>Proximo passo</Label>
                <Input className="mt-1" placeholder="Ex: retornar segunda as 14h"
                  value={atv.proximo_passo} onChange={(e) => setAtv({ ...atv, proximo_passo: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Proximo contato</Label>
                  <Input type="datetime-local" className="mt-1" value={atv.proximo_contato_at}
                    onChange={(e) => setAtv({ ...atv, proximo_contato_at: e.target.value })} />
                </div>
                <div>
                  <Label>Mover pra</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                    value={atv.novo_status} onChange={(e) => setAtv({ ...atv, novo_status: e.target.value })}>
                    {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <Button onClick={saveAtividade} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar atividade"}
              </Button>
            </div>
          )}

          {tab === "agendar" && (
            <div className="space-y-3">
              <div>
                <Label>Titulo</Label>
                <Input className="mt-1" value={ag.titulo}
                  onChange={(e) => setAg({ ...ag, titulo: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Data</Label>
                  <Input type="date" className="mt-1" value={ag.data_reuniao}
                    onChange={(e) => setAg({ ...ag, data_reuniao: e.target.value })} />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input type="time" className="mt-1" value={ag.hora}
                    onChange={(e) => setAg({ ...ag, hora: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Duracao (min)</Label>
                <Input type="number" className="mt-1" value={ag.duracao_min}
                  onChange={(e) => setAg({ ...ag, duracao_min: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Link (Google Meet, Zoom, etc)</Label>
                <Input className="mt-1" placeholder="Opcional" value={ag.link_reuniao}
                  onChange={(e) => setAg({ ...ag, link_reuniao: e.target.value })} />
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea className="mt-1" value={ag.notas}
                  onChange={(e) => setAg({ ...ag, notas: e.target.value })} />
              </div>
              <Button onClick={saveAgendamento} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calendar className="h-4 w-4" /> Agendar</>}
              </Button>
            </div>
          )}

          {tab === "ia" && (
            <div className="space-y-3">
              <div>
                <Label>O que gerar?</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button onClick={() => { setIaTipo("script"); setIaOutput(""); }}
                    className={`p-3 rounded-md border text-sm font-semibold transition-colors ${iaTipo === "script" ? "border-cyan bg-cyan/10 text-cyan" : "border-border hover:border-cyan/50"}`}>
                    <Phone className="h-4 w-4 mx-auto mb-1" />
                    Script de ligacao
                    <div className="text-[10px] font-normal text-muted-foreground mt-1">abertura + objecoes</div>
                  </button>
                  <button onClick={() => { setIaTipo("whatsapp"); setIaOutput(""); }}
                    className={`p-3 rounded-md border text-sm font-semibold transition-colors ${iaTipo === "whatsapp" ? "border-cyan bg-cyan/10 text-cyan" : "border-border hover:border-cyan/50"}`}>
                    <MessageCircle className="h-4 w-4 mx-auto mb-1" />
                    Mensagem WhatsApp
                    <div className="text-[10px] font-normal text-muted-foreground mt-1">3 variacoes</div>
                  </button>
                </div>
              </div>

              <Button onClick={gerarIA} disabled={iaLoading} className="w-full">
                {iaLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4" /> Gerar com IA</>}
              </Button>

              {iaOutput && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Resultado</Label>
                    <Button size="sm" variant="outline" onClick={copyIA}>
                      {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
                    </Button>
                  </div>
                  <div className="p-3 bg-background/40 border border-border rounded whitespace-pre-wrap text-sm font-mono max-h-[400px] overflow-y-auto">
                    {iaOutput}
                  </div>
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
