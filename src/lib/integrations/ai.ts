/**
 * Claude (Anthropic) - IA de atendimento e analises.
 */
import Anthropic from "@anthropic-ai/sdk";

export function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ausente");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export interface AIMessage { role: "user" | "assistant"; content: string; }

export async function aiChat(opts: {
  systemPrompt: string;
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const client = getAnthropic();
  const modelPref = opts.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  try {
    const res = await client.messages.create({
      model: modelPref,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.7,
      system: opts.systemPrompt,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const textBlock = res.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    if (!text) throw new Error(`IA respondeu vazio (stop_reason: ${res.stop_reason})`);
    return text;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    // tenta fallback pra modelo mais antigo/disponivel
    if (msg.includes("model") || msg.includes("not_found") || msg.includes("404")) {
      const res = await client.messages.create({
        model: "claude-3-5-sonnet-latest",
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.7,
        system: opts.systemPrompt,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const textBlock = res.content.find((b) => b.type === "text");
      return textBlock && "text" in textBlock ? textBlock.text : "";
    }
    throw e;
  }
}

export async function aiStreamChat(opts: {
  systemPrompt: string;
  messages: AIMessage[];
  model?: string;
  onDelta: (text: string) => void;
}) {
  const client = getAnthropic();
  const stream = await client.messages.stream({
    model: opts.model || "claude-sonnet-4-6",
    max_tokens: 2048,
    system: opts.systemPrompt,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") opts.onDelta(event.delta.text);
  }
}

export async function aiAnalisarCampanha(input: {
  nomeCliente: string;
  campanhas: { name: string; spend: number; clicks: number; cadastros: number; cpa: number }[];
  periodoLabel: string;
}): Promise<string> {
  return aiChat({
    systemPrompt:
      "Voce e um gestor senior de trafego pago da agencia Grupo Nogueira. Analise dados de campanha de forma direta, estrategica e sem enrolacao. Destaque 3-5 insights praticos.",
    messages: [{
      role: "user",
      content: `Cliente: ${input.nomeCliente}\nPeriodo: ${input.periodoLabel}\n\nCampanhas:\n${input.campanhas
        .map((c) => `- ${c.name}: R$ ${c.spend.toFixed(2)} | ${c.clicks} cliques | ${c.cadastros} cadastros | CPA R$ ${c.cpa.toFixed(2)}`)
        .join("\n")}\n\nAnalise e sugira proximos passos.`,
    }],
    temperature: 0.5,
  });
}
