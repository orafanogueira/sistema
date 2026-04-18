"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Phone, Play, Pause, MessageCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Numero { id: string; nome: string; telefone: string; is_active: boolean; msgs_enviadas_hoje: number; max_por_dia: number }
interface Campanha { id: string; nome: string; status: string; total_mensagens: number; total_enviadas: number; total_erros: number; total_respondidas: number; created_at: string }
interface Lista { id: string; name: string }

export function DisparoUI({ numeros: initialNumeros, campanhas: initialCampanhas, listas }: {
  numeros: Numero[]; campanhas: Campanha[]; listas: Lista[];
}) {
  const [numeros, setNumeros] = useState(initialNumeros);
  const [campanhas, setCampanhas] = useState(initialCampanhas);
  const [tab, setTab] = useState<"numeros" | "campanhas">("numeros");
  const [loading, setLoading] = useState(false);
  const [disparando, setDisparando] = useState(false);

  // form numero
  const [numForm, setNumForm] = useState({ nome: "", telefone: "", zapi_instance_id: "", zapi_token: "" });

  // form campanha
  const [campForm, setCampForm] = useState({
    nome: "", lista_id: "", mensagem_padrao: "",
    intervalo_min_seg: 30, intervalo_max_seg: 90,
  });

  const addNumero = async () => {
    if (!numForm.nome || !numForm.telefone) return toast.error("Nome e telefone obrigatórios");
    setLoading(true);
    try {
      const r = await fetch("/api/disparo/numeros", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(numForm),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setNumeros([...numeros, data]);
      setNumForm({ nome: "", telefone: "", zapi_instance_id: "", zapi_token: "" });
      toast.success("Número adicionado");
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const criarCampanha = async () => {
    if (!campForm.nome) return toast.error("Nome da campanha obrigatório");
    if (!campForm.lista_id) return toast.error("Selecione uma lista de prospecção");
    setLoading(true);
    try {
      const r = await fetch("/api/disparo/campanhas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campForm),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setCampanhas([data.campanha, ...campanhas]);
      toast.success(`Campanha criada`, `${data.total_mensagens} mensagens geradas com IA`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const disparar = async (campanhaId: string) => {
    setDisparando(true);
    try {
      const r = await fetch("/api/disparo/enviar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campanha_id: campanhaId }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`${data.enviadas} enviadas, ${data.erros} erros`);
      window.location.reload();
    } catch (e: unknown) {
      toast.error("Erro disparo", e instanceof Error ? e.message : "tente novamente");
    } finally { setDisparando(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === "numeros" ? "default" : "outline"} onClick={() => setTab("numeros")}>
          <Phone className="h-4 w-4" /> Números ({numeros.length})
        </Button>
        <Button variant={tab === "campanhas" ? "default" : "outline"} onClick={() => setTab("campanhas")}>
          <MessageCircle className="h-4 w-4" /> Campanhas ({campanhas.length})
        </Button>
      </div>

      {tab === "numeros" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Adicionar número WhatsApp</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input className="mt-1" placeholder="Número 1 - Comercial"
                  value={numForm.nome} onChange={(e) => setNumForm({ ...numForm, nome: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input className="mt-1" placeholder="+5511999999999"
                  value={numForm.telefone} onChange={(e) => setNumForm({ ...numForm, telefone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Z-API Instance ID</Label><Input className="mt-1"
                  value={numForm.zapi_instance_id} onChange={(e) => setNumForm({ ...numForm, zapi_instance_id: e.target.value })} /></div>
                <div><Label>Z-API Token</Label><Input className="mt-1"
                  value={numForm.zapi_token} onChange={(e) => setNumForm({ ...numForm, zapi_token: e.target.value })} /></div>
              </div>
              <Button onClick={addNumero} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Adicionar</>}
              </Button>
            </CardContent>
          </Card>

          {numeros.length > 0 && (
            <div className="space-y-2">
              {numeros.map((n) => (
                <Card key={n.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{n.nome}</div>
                      <div className="text-xs text-muted-foreground">{n.telefone}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={n.is_active ? "success" : "secondary"}>
                        {n.is_active ? "ativo" : "inativo"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {n.msgs_enviadas_hoje}/{n.max_por_dia} hoje
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "campanhas" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Nova campanha de disparo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Nome da campanha</Label><Input className="mt-1" placeholder="Prospecção oficinas SP"
                value={campForm.nome} onChange={(e) => setCampForm({ ...campForm, nome: e.target.value })} /></div>
              <div>
                <Label>Lista de prospecção</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={campForm.lista_id} onChange={(e) => setCampForm({ ...campForm, lista_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {listas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Mensagem padrão (fallback se IA falhar)</Label>
                <Textarea className="mt-1" placeholder="Olá! Vi a {{empresa}} e queria compartilhar uma ideia rápida..."
                  value={campForm.mensagem_padrao} onChange={(e) => setCampForm({ ...campForm, mensagem_padrao: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Intervalo mín (seg)</Label><Input type="number" className="mt-1" value={campForm.intervalo_min_seg}
                  onChange={(e) => setCampForm({ ...campForm, intervalo_min_seg: Number(e.target.value) })} /></div>
                <div><Label>Intervalo máx (seg)</Label><Input type="number" className="mt-1" value={campForm.intervalo_max_seg}
                  onChange={(e) => setCampForm({ ...campForm, intervalo_max_seg: Number(e.target.value) })} /></div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                IA gera mensagem personalizada pra cada lead (nome, segmento, rating). Intervalo aleatório entre {campForm.intervalo_min_seg}-{campForm.intervalo_max_seg}s reduz risco de ban.
              </div>
              <Button onClick={criarCampanha} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando mensagens com IA...</> : <><MessageCircle className="h-4 w-4" /> Criar campanha + gerar copies</>}
              </Button>
            </CardContent>
          </Card>

          {campanhas.length > 0 && (
            <div className="space-y-2">
              {campanhas.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{c.nome}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {c.total_enviadas}/{c.total_mensagens} enviadas · {c.total_erros} erros · {c.total_respondidas} respostas
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.status === "concluida" ? "success" : c.status === "ativa" ? "warning" : "secondary"}>
                          {c.status}
                        </Badge>
                        {c.status !== "concluida" && (
                          <Button size="sm" onClick={() => disparar(c.id)} disabled={disparando}>
                            {disparando ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Play className="h-3 w-3" /> Disparar</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
