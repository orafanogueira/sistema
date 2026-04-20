"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, PhoneCall, Bot, User as UserIcon, Play, Clock, CheckCircle2, XCircle, AlertCircle, MapPin } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ExtratorLeads } from "./extrator-leads";

interface Ligacao {
  id: string;
  telefone: string;
  nome?: string;
  tipo: string;
  status: string;
  resultado?: string;
  duracao_segundos?: number;
  resumo_ia?: string;
  transcript?: string;
  custo_estimado?: number;
  created_at: string;
}

interface Fila {
  id: string;
  nome: string;
  tipo: string;
  total_contatos: number;
  total_realizadas: number;
  total_qualificados: number;
  status: string;
  created_at: string;
}

const SCRIPT_PADRAO = `Você é a Ana, atendente do Rafa Nogueira do Grupo Nogueira.
Objetivo: qualificar o lead e agendar uma consultoria gratuita de 15 min com o Rafa.

Rafa é especialista em Meta Ads e Google Ads. Já gerou +50 mil leads, ajudou a vender +10 mil carros em 2025.

Roteiro:
1. "Oi, aqui é a Ana, do Grupo Nogueira. Tô ligando porque trabalhamos com tráfego pago pra lojas do seu segmento. Posso falar rapidinho?"
2. Se aceitar, pergunte quantos carros/serviços vendem por mês
3. Pergunte se já investem em anúncios e quanto
4. Prova social: lojas parecidas vendendo 2-3x mais
5. Proponha consultoria de 15min com o Rafa

Regras:
- Fale natural, não como bot
- NUNCA fale preço (só na consultoria)
- Máximo 2 frases por vez
- Português brasileiro`;

interface Nicho {
  id: string;
  slug: string;
  nome: string;
  setor_descricao?: string;
  is_default?: boolean;
}

export function LigacoesUI({ ligacoes: initial, filas }: { ligacoes: Ligacao[]; filas: Fila[] }) {
  const [ligacoes] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<"ia" | "manual">("ia");
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [form, setForm] = useState({
    nome_campanha: `Campanha ${new Date().toISOString().slice(0, 10)}`,
    telefones_txt: "",
    script: SCRIPT_PADRAO,
    voice_id: "pt-BR-FranciscaNeural",
    nicho_id: "",
  });

  useEffect(() => {
    fetch("/api/ligacoes/nichos")
      .then((r) => r.json())
      .then((data: Nicho[]) => {
        setNichos(data);
        const def = data.find((n) => n.is_default) || data[0];
        if (def) setForm((f) => ({ ...f, nicho_id: def.id }));
      })
      .catch(() => {});
  }, []);

  const dispararIA = async () => {
    const linhas = form.telefones_txt.split("\n").map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) return toast.error("Cole os telefones (um por linha)");

    const contatos = linhas.map((l) => {
      // formato: "5511999999999" ou "Nome,5511999999999" ou "Nome;5511999999999"
      const partes = l.split(/[,;|\t]/).map((x) => x.trim());
      if (partes.length >= 2) return { nome: partes[0], telefone: partes[1] };
      return { telefone: partes[0] };
    });

    if (!confirm(`Disparar IA pra ${contatos.length} números? Cada ligação custa ~$0.10-0.30 no Vapi.`)) return;

    setLoading(true);
    try {
      const r = await fetch("/api/ligacoes/disparar-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contatos,
          nome_campanha: form.nome_campanha,
          script: form.script,
          voice_id: form.voice_id,
          nicho_id: form.nicho_id || undefined,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`${data.disparadas} ligações iniciadas`, `${data.erros} erros`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  const iconStatus = (status: string) => {
    if (status === "em_andamento") return <Loader2 className="h-3 w-3 animate-spin text-amber-400" />;
    if (status === "atendida") return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    if (status === "sem_resposta") return <AlertCircle className="h-3 w-3 text-gray-400" />;
    if (status === "erro") return <XCircle className="h-3 w-3 text-red-500" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={modo === "ia" ? "default" : "outline"} onClick={() => setModo("ia")}>
          <Bot className="h-4 w-4" /> IA (Vapi.ai)
        </Button>
        <Button variant={modo === "manual" ? "default" : "outline"} onClick={() => setModo("manual")}>
          <UserIcon className="h-4 w-4" /> Manual (humano)
        </Button>
      </div>

      {modo === "ia" && (
        <>
          <ExtratorLeads
            onUsarLeads={(leads) => {
              const linhas = leads
                .filter((l) => l.telefone)
                .map((l) => `${l.nome.replace(/[,;|]/g, " ")},${l.telefone}`)
                .join("\n");
              setForm({ ...form, telefones_txt: linhas });
              toast.success(`${leads.length} leads adicionados ao campo abaixo`);
              // scroll suave pro campo de telefones
              setTimeout(() => {
                document.querySelector("[data-telefones-field]")?.scrollIntoView({ behavior: "smooth" });
              }, 200);
            }}
          />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-400" /> Campanha de ligações IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-purple-500/5 border border-purple-500/30 rounded p-3 text-xs space-y-1">
              <div className="font-semibold text-purple-300">Como funciona</div>
              <div className="text-muted-foreground space-y-1">
                <div>1. Você cola os números (um por linha)</div>
                <div>2. IA liga pra cada um com o script abaixo</div>
                <div>3. Conversa natural, qualifica, tenta agendar consultoria</div>
                <div>4. Grava, transcreve e registra tudo no CRM automaticamente</div>
                <div>5. Se qualificou ou agendou, lead move no Kanban</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome da campanha</Label>
                <Input className="mt-1" value={form.nome_campanha} onChange={(e) => setForm({ ...form, nome_campanha: e.target.value })} />
              </div>
              <div>
                <Label>🎯 Nicho do lead (adapta o script)</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.nicho_id}
                  onChange={(e) => setForm({ ...form, nicho_id: e.target.value })}
                >
                  <option value="">Roteiro padrão</option>
                  {nichos.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.is_default ? "⭐ " : ""}{n.nome}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-muted-foreground mt-1">
                  A Ana adapta a apresentação e exemplos pro nicho escolhido.
                </div>
              </div>
            </div>

            <div data-telefones-field>
              <Label>Telefones (1 por linha) — formato: Nome,5511999999999</Label>
              <Textarea
                className="mt-1 min-h-[140px] text-xs font-mono"
                placeholder={`João,5511999999999\nMaria,5511988888888\n5511977777777`}
                value={form.telefones_txt}
                onChange={(e) => setForm({ ...form, telefones_txt: e.target.value })}
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Aceita formatos: "5511999999999", "Nome,5511999999999", "Nome;5511999999999"
              </div>
            </div>

            <div>
              <Label>Script da IA (personalize)</Label>
              <Textarea
                className="mt-1 min-h-[200px] text-xs font-mono"
                value={form.script}
                onChange={(e) => setForm({ ...form, script: e.target.value })}
              />
            </div>

            <div>
              <Label>Voz</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={form.voice_id}
                onChange={(e) => setForm({ ...form, voice_id: e.target.value })}
              >
                <optgroup label="🇧🇷 Azure Neural TTS — Português BR nativo (mais natural)">
                  <option value="pt-BR-FranciscaNeural">Francisca (feminina, profissional) ⭐</option>
                  <option value="pt-BR-ThalitaNeural">Thalita (feminina, jovem)</option>
                  <option value="pt-BR-LeticiaNeural">Letícia (feminina, calma)</option>
                  <option value="pt-BR-AntonioNeural">Antônio (masculina, profissional)</option>
                  <option value="pt-BR-BrendaNeural">Brenda (feminina, animada)</option>
                  <option value="pt-BR-ElzaNeural">Elza (feminina, madura)</option>
                </optgroup>
                <optgroup label="🇧🇷 11labs multilíngue (alternativa)">
                  <option value="XB0fDUnXU5powFXDhCwa">Charlotte (feminina)</option>
                  <option value="XrExE9yKIg1WjnnlVkGX">Matilda (feminina jovem)</option>
                  <option value="pNInz6obpgDQGcFmaJgB">Adam (masculina)</option>
                </optgroup>
                <optgroup label="🇺🇸 Inglês (só pra prospecção EUA)">
                  <option value="en-US-JennyNeural">Jenny (Azure feminina EN)</option>
                  <option value="21m00Tcm4TlvDq8ikWAM">Rachel (11labs EN)</option>
                </optgroup>
              </select>
              <div className="text-[10px] text-muted-foreground mt-1">
                Azure Neural TTS tem vozes PT-BR nativas (melhor qualidade/sotaque). Recomendo Francisca pra prospecção B2B.
              </div>
            </div>

            <div className="bg-background/40 border border-border rounded p-2 text-[10px] text-muted-foreground">
              🌎 <b>Seleção de país automática:</b> o sistema detecta o país pelo prefixo do telefone
              (+55 = BR, +1 = US) e usa o número Vapi correspondente da lista acima.
              Cadastre pelo menos 1 número (com &quot;Default&quot;) pra funcionar.
            </div>

            <Button onClick={dispararIA} disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Disparando ligações...</>
              ) : (
                <><PhoneCall className="h-4 w-4" /> Disparar campanha IA</>
              )}
            </Button>

            <div className="text-[10px] text-muted-foreground">
              Precisa ter configurado no Vercel: <code>VAPI_API_KEY</code> e <code>VAPI_PHONE_NUMBER_ID</code>.
              Comprar número no dashboard Vapi (~$2/mês) + créditos (~$0.10-0.30 por ligação).
              Crie conta em <a href="https://vapi.ai" target="_blank" rel="noopener" className="text-cyan hover:underline">vapi.ai</a>.
            </div>
          </CardContent>
        </Card>
        </>
      )}

      {modo === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Fluxo manual (humano)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pra ligações manuais, use a aba <a href="/prospeccao" className="text-cyan hover:underline">Prospecção ativa</a>:
            vai listando os leads pendentes, mostra script na tela, e você clica "Atendeu / Não atendeu / Agendou / Sem interesse" ao terminar cada call. Tudo fica no CRM automaticamente.
          </CardContent>
        </Card>
      )}

      {filas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filas.map((f) => (
                <div key={f.id} className="flex items-center justify-between border border-border rounded p-3 text-xs">
                  <div>
                    <div className="font-semibold">{f.nome}</div>
                    <div className="text-muted-foreground">{f.total_realizadas}/{f.total_contatos} realizadas · {f.total_qualificados} qualificados</div>
                  </div>
                  <Badge variant={f.status === "ativa" ? "warning" : f.status === "concluida" ? "success" : "secondary"}>
                    {f.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ligacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Últimas ligações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Tel</th>
                    <th className="p-2 text-left">Resultado</th>
                    <th className="p-2 text-left">Duração</th>
                    <th className="p-2 text-left">Resumo IA</th>
                  </tr>
                </thead>
                <tbody>
                  {ligacoes.slice(0, 100).map((l, i) => (
                    <tr key={l.id} className="border-b border-border hover:bg-background/40 cursor-pointer"
                      onClick={() => window.location.href = `/ligacoes/${l.id}`}>
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">{iconStatus(l.status)}</td>
                      <td className="p-2">
                        {l.tipo === "ia_vapi" ? (
                          <Badge variant="secondary" className="text-[9px]"><Bot className="h-2 w-2 mr-1" /> IA</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]"><UserIcon className="h-2 w-2 mr-1" /> Manual</Badge>
                        )}
                      </td>
                      <td className="p-2">{l.nome || "—"}</td>
                      <td className="p-2 font-mono text-[10px]">{l.telefone}</td>
                      <td className="p-2">
                        {l.resultado ? (
                          <Badge
                            variant={
                              l.resultado === "agendou" ? "success" :
                              l.resultado === "sem_interesse" ? "destructive" :
                              "secondary"
                            }
                            className="text-[9px]"
                          >
                            {l.resultado}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-[10px]">
                        {l.duracao_segundos ? `${Math.floor(l.duracao_segundos / 60)}:${(l.duracao_segundos % 60).toString().padStart(2, "0")}` : "—"}
                      </td>
                      <td className="p-2 text-[10px] max-w-[300px] truncate" title={l.resumo_ia}>
                        {l.resumo_ia || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
