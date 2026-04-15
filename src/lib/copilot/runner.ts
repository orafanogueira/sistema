/**
 * Runner do Copiloto IA - usa Claude com tool use em loop.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COPILOT_TOOLS, executeTool } from "./tools";

const SYSTEM_PROMPT = `Voce e o copiloto do Grupo Nogueira OS, sistema de gestao da agencia.

Seu papel: ajudar o usuario a gerenciar clientes, campanhas, cobrancas, alertas, etc.
- Voce TEM tools pra executar acoes reais no sistema.
- Sempre que uma pergunta exigir dado atual, USE as tools (nao chute).
- Antes de executar acoes destrutivas (criar cobranca, deletar, etc), CONFIRME com o usuario.
- Responda em portugues brasileiro, direto, sem enrolacao.
- Mostre numeros formatados (R$ 1.234,56). Inclua insights praticos.
- Se uma tool retornar erro, tente alternativa ou explique claramente o problema.
- Quando citar cliente, use o nome (nao o id).`;

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotContext {
  supabase: SupabaseClient;
  tenant_id: string;
  user_id: string;
}

export async function runCopilot(opts: {
  messages: CopilotMessage[];
  context: CopilotContext;
  onToolCall?: (name: string, input: unknown) => void;
  onToolResult?: (name: string, result: unknown) => void;
}): Promise<{ reply: string; tool_calls: { name: string; input: unknown; result: unknown }[] }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ausente");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const toolCalls: { name: string; input: unknown; result: unknown }[] = [];

  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role, content: m.content,
  }));

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  let finalText = "";

  for (let i = 0; i < 6; i++) {
    const res = await anthropic.messages.create({
      model, max_tokens: 2048, system: SYSTEM_PROMPT, tools: COPILOT_TOOLS, messages,
    });

    if (res.stop_reason === "end_turn") {
      const text = res.content.find((b) => b.type === "text");
      finalText = text && "text" in text ? text.text : "";
      break;
    }

    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        opts.onToolCall?.(block.name, block.input);
        const result = await executeTool(block.name, block.input as Record<string, unknown>, opts.context);
        opts.onToolResult?.(block.name, result);
        toolCalls.push({ name: block.name, input: block.input, result });
        toolResults.push({
          type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    } else {
      const text = res.content.find((b) => b.type === "text");
      finalText = text && "text" in text ? text.text : "";
      break;
    }
  }

  return { reply: finalText, tool_calls: toolCalls };
}
