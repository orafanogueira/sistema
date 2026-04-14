/**
 * IA automotiva - Claude com tool use.
 * Tools disponiveis:
 *  - consultar_estoque(marca?, modelo?, ano_min?, preco_max?)
 *  - enviar_foto_veiculo(veiculo_id, telefone)
 *  - simular_financiamento(veiculo_id, entrada, parcelas)
 *  - agendar_visita(lead_id, data_hora)
 *  - escalar_para_humano(lead_id, motivo)
 */
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { ZAPIClient } from "@/lib/integrations/zapi";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_estoque",
    description: "Consulta veiculos disponiveis no estoque. Filtra por marca, modelo, ano minimo e preco maximo.",
    input_schema: {
      type: "object",
      properties: {
        marca: { type: "string", description: "Marca do veiculo (opcional)" },
        modelo: { type: "string", description: "Modelo (opcional)" },
        ano_min: { type: "number", description: "Ano minimo (opcional)" },
        preco_max: { type: "number", description: "Preco maximo em reais (opcional)" },
      },
    },
  },
  {
    name: "enviar_foto_veiculo",
    description: "Envia fotos e ficha tecnica de um veiculo especifico para o WhatsApp do lead.",
    input_schema: {
      type: "object",
      properties: {
        veiculo_id: { type: "string", description: "ID do veiculo" },
      },
      required: ["veiculo_id"],
    },
  },
  {
    name: "simular_financiamento",
    description: "Simula financiamento para um veiculo. Retorna parcelas e valor.",
    input_schema: {
      type: "object",
      properties: {
        veiculo_id: { type: "string" },
        entrada: { type: "number", description: "Valor de entrada em R$" },
        parcelas: { type: "number", description: "Numero de parcelas (12, 24, 36, 48, 60)" },
      },
      required: ["veiculo_id", "entrada", "parcelas"],
    },
  },
  {
    name: "agendar_visita",
    description: "Agenda visita do lead na loja. Cria evento no Google Calendar e move lead pra estagio 'Visita agendada'.",
    input_schema: {
      type: "object",
      properties: {
        data_hora: { type: "string", description: "ISO datetime da visita" },
      },
      required: ["data_hora"],
    },
  },
  {
    name: "escalar_para_humano",
    description: "Quando a IA nao consegue resolver, escala pro vendedor humano.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string" } },
      required: ["motivo"],
    },
  },
];

interface AutomotivoContext {
  cliente_id: string;
  lead_id: string;
  whatsapp: string;
  loja_nome: string;
}

export async function aiAutomotivoConversation(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  context: AutomotivoContext
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ausente");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const supabase = await createServiceClient();

  let messages = [...history];
  let finalText = "";

  // Loop ate Claude parar de chamar tools (max 5 iter)
  for (let iter = 0; iter < 5; iter++) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // se nao chamou tool, e a resposta final
    if (res.stop_reason !== "tool_use") {
      const text = res.content.find((b) => b.type === "text");
      finalText = text && "text" in text ? text.text : "";
      break;
    }

    // executa tools
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const result = await executeTool(block.name, block.input as Record<string, unknown>, context, supabase);
      toolResults.push({
        type: "tool_result", tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    messages = [
      ...messages,
      { role: "assistant", content: JSON.stringify(res.content) }, // simplificado
      { role: "user", content: JSON.stringify(toolResults) },
    ];
  }

  return finalText;
}

async function executeTool(name: string, input: Record<string, unknown>, ctx: AutomotivoContext, supabase: Awaited<ReturnType<typeof createServiceClient>>) {
  switch (name) {
    case "consultar_estoque": {
      let q = supabase.from("veiculos").select("id,marca,modelo,ano,km,preco,combustivel,cambio,opcionais")
        .eq("cliente_id", ctx.cliente_id).eq("status", "disponivel").limit(5);
      if (input.marca) q = q.ilike("marca", `%${input.marca}%`);
      if (input.modelo) q = q.ilike("modelo", `%${input.modelo}%`);
      if (input.ano_min) q = q.gte("ano", Number(input.ano_min));
      if (input.preco_max) q = q.lte("preco", Number(input.preco_max));
      const { data } = await q;
      return { veiculos: data || [], total: (data || []).length };
    }
    case "enviar_foto_veiculo": {
      const { data: v } = await supabase.from("veiculos").select("*").eq("id", input.veiculo_id as string).maybeSingle();
      if (!v) return { error: "veiculo nao encontrado" };
      const fotos = (v.fotos as { url: string }[]) || [];
      const zapi = new ZAPIClient();
      const ficha = `🚗 *${v.marca} ${v.modelo} ${v.ano}*\n💰 R$ ${Number(v.preco).toLocaleString("pt-BR")}\n📍 ${v.km} km\n⛽ ${v.combustivel}\n⚙️ ${v.cambio}${v.opcionais?.length ? `\n✨ ${v.opcionais.join(", ")}` : ""}`;
      await zapi.sendText(ctx.whatsapp, ficha);
      // envia ate 3 fotos
      for (const f of fotos.slice(0, 3)) {
        try {
          await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_INSTANCE_TOKEN}/send-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Client-Token": process.env.ZAPI_CLIENT_TOKEN! },
            body: JSON.stringify({ phone: ctx.whatsapp, image: f.url, caption: "" }),
          });
        } catch {}
      }
      await supabase.from("lead_activities").insert({
        lead_id: ctx.lead_id, type: "message_out",
        content: `Fotos do ${v.marca} ${v.modelo} enviadas`,
        metadata: { veiculo_id: v.id, source: "ia" },
      });
      return { ok: true, fotos_enviadas: fotos.length };
    }
    case "simular_financiamento": {
      const { data: v } = await supabase.from("veiculos").select("preco,marca,modelo").eq("id", input.veiculo_id as string).maybeSingle();
      if (!v) return { error: "veiculo nao encontrado" };
      const preco = Number(v.preco);
      const entrada = Number(input.entrada);
      const parcelas = Number(input.parcelas);
      const financiado = preco - entrada;
      const taxa = 0.0199; // 1,99% a.m. - mock; substituir por API real (Creditas)
      const valorParcela = (financiado * taxa * Math.pow(1 + taxa, parcelas)) / (Math.pow(1 + taxa, parcelas) - 1);
      const cetAnual = (Math.pow(1 + taxa, 12) - 1) * 100;

      const { data: financ } = await supabase.from("financiamentos").insert({
        tenant_id: ctx.cliente_id, // ajuste se tiver tenant separado
        cliente_id: ctx.cliente_id, lead_id: ctx.lead_id, veiculo_id: input.veiculo_id as string,
        provider: "simulacao_interna", valor_veiculo: preco, entrada, parcelas,
        taxa_mensal: taxa, valor_parcela: valorParcela, cet_anual: cetAnual,
        status: "simulacao",
      }).select().single();

      return {
        veiculo: `${v.marca} ${v.modelo}`,
        valor_total: preco, entrada, financiado,
        parcelas, taxa_mensal_pct: (taxa * 100).toFixed(2),
        valor_parcela: valorParcela.toFixed(2), cet_anual_pct: cetAnual.toFixed(2),
        financiamento_id: financ?.id,
      };
    }
    case "agendar_visita": {
      // marca lead + cria activity. Calendar real fica como TODO ate Google OAuth ativo.
      const { data: stage } = await supabase.from("pipeline_stages").select("id")
        .ilike("name", "%visita agendada%").limit(1).maybeSingle();
      await supabase.from("leads").update({ stage_id: stage?.id, status: "qualificado" }).eq("id", ctx.lead_id);
      await supabase.from("lead_activities").insert({
        lead_id: ctx.lead_id, type: "followup_scheduled",
        content: `Visita agendada para ${input.data_hora}`,
        metadata: { data_hora: input.data_hora, source: "ia" },
      });
      return { ok: true, agendada_para: input.data_hora };
    }
    case "escalar_para_humano": {
      await supabase.from("lead_activities").insert({
        lead_id: ctx.lead_id, type: "note",
        content: `IA escalou: ${input.motivo}`, metadata: { source: "ia_escalation" },
      });
      // TODO: notificar gerente via WhatsApp
      return { ok: true, escalado: true };
    }
    default: return { error: "tool desconhecida" };
  }
}
