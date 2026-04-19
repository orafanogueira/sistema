"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Send, Paperclip, Trash2, Mail, Sparkles, Brain } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Anexo {
  filename: string;
  content_url: string;
}

interface Contato {
  email?: string;
  nome?: string;
  name?: string;
  title?: string;
  organization_name?: string;
  city?: string;
  state?: string;
  linkedin_url?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  contatos: Contato[];
}

const PROMPT_DEFAULT = `Você é o Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.
Gere um email B2B SUPER PERSONALIZADO pra esse contato, usando o research da empresa dele.

CONTEXTO SEU:
- +50 mil leads gerados, +10 mil carros vendidos em 2025
- +120 milhões em receita gerada com Meta Ads e Google Ads
- Foco em tráfego pago pra performance real

REGRAS CRÍTICAS:
- Assunto até 60 chars, desperta curiosidade SEM parecer spam
- Corpo em HTML simples (<p>), 6-10 linhas
- PERSONALIZE com detalhes REAIS da empresa (use o research fornecido)
- Mostre que você pesquisou: cite algo específico (serviço, nicho, cidade, diferencial)
- Gancho na primeira linha
- Ofereça insight baseado no que identificou sobre a empresa
- CTA leve: "Vale 15min?"
- NUNCA SEO/orgânico/rating — só tráfego pago
- Acentuação correta em português
- Tom: dono falando com dono, de igual pra igual

Retorne JSON estrito:
{"assunto":"...","corpo_html":"<p>...</p><p>...</p>"}`;

export function ModalResearchEmail({ open, onClose, contatos }: Props) {
  const [loading, setLoading] = useState(false);
  const [nomeCampanha, setNomeCampanha] = useState(`Apollo research ${new Date().toISOString().slice(0, 10)}`);
  const [fromName, setFromName] = useState("Rafa Nogueira");
  const [fromEmail, setFromEmail] = useState("rafa@gruponogueiramkt.com");
  const [promptIA, setPromptIA] = useState(PROMPT_DEFAULT);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [novoAnexo, setNovoAnexo] = useState<Anexo>({ filename: "", content_url: "" });

  if (!open) return null;

  const validos = contatos.filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));
  const comEmpresa = validos.filter((c) => c.organization_name).length;

  const disparar = async () => {
    if (validos.length === 0) return toast.error("Nenhum contato com email válido");
    if (!confirm(`Disparar research + email pra ${validos.length} contatos? A IA vai pesquisar cada empresa antes de escrever (~3-5s por contato).`)) return;

    setLoading(true);
    try {
      const r = await fetch("/api/disparo-direto/email-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contatos: validos,
          prompt_ia: promptIA,
          anexos,
          nome_campanha: nomeCampanha,
          from_name: fromName,
          from_email: fromEmail,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(
        `${data.enviados} enviados · ${data.pesquisados} empresas pesquisadas`,
        `${data.erros} erros · ${data.pulados || 0} pulados (já receberam antes)`
      );
      onClose();
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            <h2 className="font-bold">Email com Research Profundo</h2>
            <Badge variant="secondary" className="text-[10px]">IA estuda cada empresa antes</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-purple-500/5 border border-purple-500/30 rounded p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-purple-300">
              <Sparkles className="h-3 w-3" /> Como funciona o research
            </div>
            <div className="text-muted-foreground space-y-1">
              <div>1. Pra cada contato, a IA busca a empresa no Google via Serper</div>
              <div>2. Identifica o site oficial, scrapeia a homepage, pega descrição e serviços</div>
              <div>3. Coleta redes sociais (Instagram, LinkedIn)</div>
              <div>4. Gera copy SUPER personalizada com os dados reais da empresa</div>
              <div>5. Envia via Resend (1 email por empresa, nunca duplicado)</div>
            </div>
          </div>

          <div className="bg-background/40 border border-border rounded p-3 text-xs space-y-1">
            <div>Total de contatos: <b>{contatos.length}</b></div>
            <div>Com email válido: <b className="text-cyan">{validos.length}</b></div>
            <div>Com empresa pra pesquisar: <b className="text-purple-300">{comEmpresa}</b></div>
            <div className="text-muted-foreground">
              Tempo estimado: ~{Math.ceil(validos.length * 5 / 60)}min · Custo: ~${(validos.length * 0.005).toFixed(2)} em Serper + Resend free
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome da campanha</Label>
              <Input className="mt-1" value={nomeCampanha} onChange={(e) => setNomeCampanha(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>De (nome)</Label>
                <Input className="mt-1" value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </div>
              <div>
                <Label>De (email)</Label>
                <Input className="mt-1" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <Label>Prompt da IA (com instruções de personalização)</Label>
            <Textarea
              className="mt-1 min-h-[200px] text-xs font-mono"
              value={promptIA}
              onChange={(e) => setPromptIA(e.target.value)}
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              A IA recebe: nome, cargo, empresa, cidade, LinkedIn + website + descrição do site + redes sociais.
              Quanto mais específico o prompt sobre COMO usar essas infos, melhor o email sai.
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2"><Paperclip className="h-3 w-3" /> Anexos (opcional)</Label>
            {anexos.length > 0 && (
              <div className="space-y-2 mt-2">
                {anexos.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background/40 border border-border rounded p-2 text-xs">
                    <span className="flex-1 truncate">
                      <b>{a.filename}</b> · <span className="text-muted-foreground">{a.content_url}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setAnexos(anexos.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 mt-2">
              <Input
                placeholder="arquivo.pdf"
                value={novoAnexo.filename}
                onChange={(e) => setNovoAnexo({ ...novoAnexo, filename: e.target.value })}
              />
              <Input
                placeholder="URL pública"
                value={novoAnexo.content_url}
                onChange={(e) => setNovoAnexo({ ...novoAnexo, content_url: e.target.value })}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!novoAnexo.filename || !novoAnexo.content_url) return toast.error("Nome e URL obrigatórios");
                  setAnexos([...anexos, novoAnexo]);
                  setNovoAnexo({ filename: "", content_url: "" });
                }}
              >
                + Add
              </Button>
            </div>
          </div>

          <div className="sticky bottom-0 bg-card pt-3 border-t border-border flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">Cancelar</Button>
            <Button onClick={disparar} disabled={loading} className="flex-1">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Pesquisando e enviando... (pode demorar alguns minutos)</>
              ) : (
                <><Send className="h-4 w-4" /> Disparar com research ({validos.length})</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
