/**
 * Runner de agentes IA - executa agente do catalogo com input do usuario.
 * Persiste runs em agent_runs pra historico e analytics.
 */
import { aiChat } from "@/lib/integrations/ai";
import { getAgent } from "./catalog";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RunAgentInput {
  agent_key: string;
  input: Record<string, unknown>;
  cliente_context?: {
    nome?: string;
    nicho?: string;
    persona?: string;
    tom?: string;
    cidade?: string;
  };
  override_prompt?: string;
  override_temperature?: number;
}

export interface RunAgentResult {
  output: string;
  output_data?: Record<string, unknown>;
  duration_ms: number;
  agent_key: string;
}

export async function runAgent(
  supabase: SupabaseClient,
  tenant_id: string,
  cliente_id: string | null,
  user_id: string | null,
  params: RunAgentInput
): Promise<RunAgentResult> {
  const def = getAgent(params.agent_key);
  if (!def) throw new Error(`Agente desconhecido: ${params.agent_key}`);

  // Monta prompt enriquecido com contexto do cliente
  const ctx = params.cliente_context;
  const contextoExtra = ctx
    ? `\n\n[CONTEXTO DO CLIENTE]\nNome: ${ctx.nome || "-"}\nNicho: ${ctx.nicho || "-"}${ctx.persona ? `\nPersona: ${ctx.persona}` : ""}${ctx.tom ? `\nTom de voz: ${ctx.tom}` : ""}${ctx.cidade ? `\nRegiao: ${ctx.cidade}` : ""}`
    : "";

  const systemPrompt = (params.override_prompt || def.default_system_prompt) + contextoExtra;

  // Renderiza input como texto user-friendly
  const inputText = renderInput(params.input);

  const start = Date.now();
  let output = "";
  let output_data: Record<string, unknown> = {};
  let status = "success";
  let error: string | null = null;

  try {
    output = await aiChat({
      systemPrompt,
      messages: [{ role: "user", content: inputText }],
      temperature: params.override_temperature ?? def.recommended_temperature,
      model: def.recommended_model,
      maxTokens: 2048,
    });

    if (def.output_format === "json") {
      try {
        const cleaned = output.replace(/```json\s*|\s*```/g, "").trim();
        output_data = JSON.parse(cleaned);
      } catch { /* mantem output raw */ }
    }
  } catch (e: unknown) {
    status = "error";
    error = e instanceof Error ? e.message : "Erro";
    output = "";
  }

  const duration_ms = Date.now() - start;

  // persiste run
  await supabase.from("agent_runs").insert({
    tenant_id, cliente_id, agent_key: params.agent_key, user_id,
    input: params.input, output, output_data, duration_ms, status, error,
  });

  // incrementa contador no agent (se existe instancia)
  if (cliente_id) {
    await supabase.rpc("noop", {}); // placeholder - melhor fazer update direto
    await supabase.from("ai_agents")
      .update({ usage_count: 1, last_used_at: new Date().toISOString() })
      .eq("agent_key", params.agent_key)
      .eq("cliente_id", cliente_id);
  }

  if (status === "error") throw new Error(error || "Erro IA");
  return { output, output_data, duration_ms, agent_key: params.agent_key };
}

function renderInput(input: Record<string, unknown>): string {
  if (!input || Object.keys(input).length === 0) return "Sem inputs especificos. Use defaults razoaveis.";
  const lines = ["[INPUT DO USUARIO]"];
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "object") lines.push(`${k}: ${JSON.stringify(v, null, 2)}`);
    else lines.push(`${k}: ${v}`);
  }
  return lines.join("\n");
}
