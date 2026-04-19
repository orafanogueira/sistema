"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Send, Linkedin, TrendingUp } from "lucide-react";
import { toast } from "@/components/ui/toaster";

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

const PROMPT_ESPECIALISTA_LINKEDIN = `Você é um copywriter ESPECIALISTA em cold email B2B com FOCO em alta taxa de abertura e resposta.

OBJETIVO: gerar email de prospecção pra contato vindo do LinkedIn (Apollo) que:
- Abertura > 60% (vs média 21%)
- Resposta > 8% (vs média 1-3%)

QUEM ESTÁ ENVIANDO: Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.
- +50 mil leads gerados em 2025
- +10 mil carros vendidos com tráfego pago
- +120 milhões em receita gerada pra clientes

PRINCÍPIOS DE ALTA ABERTURA (ASSUNTO):
- Máximo 40 caracteres (mobile-first, preview total)
- NUNCA usar: "oferta", "promoção", "imperdível", "grátis", "100%", emoji genérico
- USAR: nome da empresa do destinatário, número específico, pergunta provocativa
- Tom: conversa entre 2 pessoas, NUNCA marketing
- Padrões que funcionam:
  * "{empresa}: 47 carros em 30 dias?"
  * "uma ideia pra {empresa}"
  * "vi a {empresa} hoje"
  * "{nome}, 15min essa semana?"
  * "{empresa} + meta ads"
  * "rápido sobre a {empresa}"
- Tudo em minúsculo aumenta abertura (parece pessoal, não automático)

PRINCÍPIOS DE ALTA RESPOSTA (CORPO):
- Primeira linha: gancho ESPECÍFICO sobre a empresa do destinatário (cite cargo + empresa OU LinkedIn)
- 2ª-3ª linha: insight relevante baseado em dados ("ajudei lojas como a sua a vender X")
- Mencione 1 prova social CONCRETA com número
- CTA SUAVE: nunca "agendar reunião" — sempre "vale 15min?", "topa um papo rápido?"
- Termine sem assinatura corporativa pesada — só "Rafa"
- Máximo 6-8 linhas TOTAL
- HTML simples (<p>) sem CSS/imagens
- Sem links de descadastro/disclaimer (parece pessoal)
- ZERO jargão de marketing ("performance", "ROAS", "funil")
- ZERO menção a SEO/orgânico/rating

ESTRUTURA OBRIGATÓRIA DO CORPO:
1. <p>{primeira linha — gancho específico mencionando empresa ou cargo}</p>
2. <p>{insight + prova social com número concreto}</p>
3. <p>{CTA suave + 1 pergunta aberta}</p>
4. <p>— Rafa</p>

EXEMPLOS DE CORPOS QUE CONVERTEM:

Exemplo 1:
<p>{Nome}, vi que você é {cargo} na {empresa} — multimarcas em {cidade}, certo?</p>
<p>Ajudei uma loja parecida (Auto Centro SP) a sair de 22 pra 58 carros vendidos/mês em 60 dias só com Meta Ads. Investimento de 6k/mês.</p>
<p>Vale 15min essa semana pra eu te mostrar como ficaria pra {empresa}?</p>
<p>— Rafa</p>

Exemplo 2:
<p>{Nome}, tô vendo o trabalho da {empresa} no LinkedIn e tive uma ideia.</p>
<p>Trabalho com lojas do mesmo nicho gerando 200-400 leads qualificados/mês com tráfego pago. Recente: cliente com investimento similar saiu de 18 pra 47 vendas em 45 dias.</p>
<p>Topa um papo rápido essa semana?</p>
<p>— Rafa</p>

Retorne JSON estrito:
{"assunto":"assunto curto, minúsculo, ≤40 chars","corpo_html":"<p>...</p><p>...</p><p>...</p><p>— Rafa</p>"}`;

export function ModalEmailLinkedIn({ open, onClose, contatos }: Props) {
  const [loading, setLoading] = useState(false);
  const [nomeCampanha, setNomeCampanha] = useState(`LinkedIn outreach ${new Date().toISOString().slice(0, 10)}`);
  const [fromName, setFromName] = useState("Rafa Nogueira");
  const [fromEmail, setFromEmail] = useState("rafa@gruponogueiramkt.com");
  const [promptIA, setPromptIA] = useState(PROMPT_ESPECIALISTA_LINKEDIN);

  if (!open) return null;

  const validos = contatos.filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));

  const disparar = async () => {
    if (validos.length === 0) return toast.error("Nenhum contato com email válido");
    if (!confirm(`Disparar email LinkedIn (com research) pra ${validos.length} contatos? IA pesquisa cada empresa antes (~5s por contato).`)) return;

    setLoading(true);
    try {
      const r = await fetch("/api/disparo-direto/email-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contatos: validos,
          prompt_ia: promptIA,
          nome_campanha: nomeCampanha,
          from_name: fromName,
          from_email: fromEmail,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(
        `${data.enviados} enviados`,
        `${data.pesquisados} pesquisados · ${data.erros} erros · ${data.pulados || 0} pulados`
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
            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            <h2 className="font-bold">Email LinkedIn — Especialista em Alta Abertura</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-blue-500/5 border border-blue-500/30 rounded p-3 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-300">
              <TrendingUp className="h-3 w-3" /> Otimizado pra +60% abertura · +8% resposta
            </div>
            <div className="text-muted-foreground space-y-1">
              <div>✅ Assunto curto (≤40 chars), minúsculo, sem palavras-spam</div>
              <div>✅ Personalização extrema (research da empresa antes do envio)</div>
              <div>✅ Corpo conversacional (sem cara de marketing)</div>
              <div>✅ Prova social com número concreto</div>
              <div>✅ CTA suave (vale 15min?) — não "agendar reunião"</div>
              <div>✅ Sem assinatura corporativa pesada</div>
            </div>
          </div>

          <div className="bg-background/40 border border-border rounded p-3 text-xs">
            <div>Total de contatos: <b>{contatos.length}</b></div>
            <div>Com email válido: <b className="text-cyan">{validos.length}</b></div>
            <div className="text-muted-foreground">
              Tempo estimado: ~{Math.ceil(validos.length * 5 / 60)}min · Cada email é único e pesquisado
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
            <Label>Prompt do agente especialista</Label>
            <Textarea
              className="mt-1 min-h-[200px] text-xs font-mono"
              value={promptIA}
              onChange={(e) => setPromptIA(e.target.value)}
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              Esse prompt já tá calibrado pros benchmarks de cold email LinkedIn de alta performance. Edite se quiser personalizar mais.
            </div>
          </div>

          <div className="sticky bottom-0 bg-card pt-3 border-t border-border flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">Cancelar</Button>
            <Button onClick={disparar} disabled={loading} className="flex-1 bg-gradient-to-r from-[#0A66C2] to-blue-700 hover:from-[#0A66C2]/90">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Pesquisando + enviando...</>
              ) : (
                <><Send className="h-4 w-4" /> Disparar pra {validos.length} contatos</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
