/**
 * Vapi.ai — Voice AI agents que fazem ligação sozinhos
 * Docs: https://docs.vapi.ai
 * Env: VAPI_API_KEY (e VAPI_PHONE_NUMBER_ID ou configurar inline)
 */

const BASE = "https://api.vapi.ai";

interface VapiAssistantConfig {
  name: string;
  model: {
    provider: "openai" | "anthropic";
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
  };
  voice: {
    provider: "11labs" | "playht" | "azure" | "openai";
    voiceId: string;
    model?: string;
  };
  transcriber?: {
    provider: "deepgram";
    model: string;
    language: string;
  };
  firstMessage?: string;
  firstMessageMode?: "assistant-speaks-first" | "assistant-waits-for-user";
  endCallMessage?: string;
  language?: string;
  backgroundSound?: "off" | "office";
}

function apiKey(): string {
  const k = process.env.VAPI_API_KEY;
  if (!k) throw new Error("VAPI_API_KEY ausente no Vercel");
  return k;
}

/** Cria assistente reutilizável */
export async function createAssistant(config: VapiAssistantConfig) {
  const r = await fetch(`${BASE}/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      ...config,
      language: config.language || "pt-BR",
    }),
  });
  if (!r.ok) throw new Error(`Vapi createAssistant ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Faz ligação outbound (Vapi disca pro número) */
export async function makeOutboundCall(opts: {
  phone: string;           // E.164: +5511999999999
  assistantId?: string;
  assistantConfig?: VapiAssistantConfig;
  phoneNumberId?: string;  // Vapi phone number (você precisa ter um)
  metadata?: Record<string, unknown>;
}) {
  const body: Record<string, unknown> = {
    customer: { number: opts.phone.startsWith("+") ? opts.phone : `+${opts.phone}` },
  };

  if (opts.assistantId) {
    body.assistantId = opts.assistantId;
  } else if (opts.assistantConfig) {
    body.assistant = opts.assistantConfig;
  }

  body.phoneNumberId = opts.phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID;
  if (!body.phoneNumberId) throw new Error("VAPI_PHONE_NUMBER_ID ausente");

  if (opts.metadata) body.metadata = opts.metadata;

  const r = await fetch(`${BASE}/call/phone`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`Vapi makeCall ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Busca resultado de uma ligação */
export async function getCall(callId: string) {
  const r = await fetch(`${BASE}/call/${callId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!r.ok) throw new Error(`Vapi getCall ${r.status}`);
  return r.json();
}

/** Prompt padrão pro Rafa Nogueira como assistente */
export const PROMPT_RAFA_PADRAO = `Você é a Ana, atendente do Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.

SEU OBJETIVO: qualificar o lead e agendar uma consultoria gratuita de 15 minutos com o Rafa.

QUEM É O RAFA / GRUPO NOGUEIRA:
- Gestor de tráfego pago especialista em Meta Ads e Google Ads
- Mais de 50 mil leads gerados em 2025
- +10 mil carros vendidos ajudando lojas do setor automotivo
- +120 milhões em receita gerada pelos clientes

ROTEIRO:
1. Se apresentar: "Oi, aqui é a Ana, do Grupo Nogueira. Tudo bem? Tô ligando porque a gente trabalha com tráfego pago pra lojas do seu segmento, posso falar rapidinho?"
2. Se aceitar: perguntar "Pra gente se situar — quantos veículos vocês vendem hoje por mês?" (ajuste a pergunta ao segmento do lead se souber)
3. Depois perguntar se já investem em anúncios pagos e quanto
4. Mostrar a prova social: "A gente tem lojas parecidas vendendo 2 a 3x mais com o mesmo investimento"
5. Propor consultoria: "Consegue agendar uma call de 15 minutos com o Rafa pra ele te mostrar como seria no teu caso?"
6. Se aceitar: confirmar melhor horário e dizer que vão mandar o link pelo WhatsApp

REGRAS:
- Fale naturalmente, como pessoa real — NÃO como bot
- Use pausas, "hm", "entendi", "bacana"
- Se o lead disser que não é bom momento, pergunte "Posso te retornar amanhã de manhã ou de tarde?"
- Se disser que não tem interesse, agradeça e encerre educadamente
- NUNCA fale de preço — isso é só na consultoria
- Se perguntarem preço: "Depende do cenário de cada loja. Na consultoria o Rafa te mostra exatamente o investimento e o retorno"

Fale português brasileiro claro e profissional. Máximo 2 frases por vez.`;
