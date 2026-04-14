/**
 * Ingest universal de leads.
 * Recebe lead normalizado + cliente_id e:
 *  1. Cria lead no DB
 *  2. Tenta linkar com veiculo do estoque (se automotivo)
 *  3. Atribui vendedor (round-robin)
 *  4. Dispara automacoes do trigger 'lead_created'
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedLead } from "./parsers";
import { normalizePhone } from "./parsers";

interface IngestParams {
  supabase: SupabaseClient;
  tenant_id: string;
  cliente_id: string;
  lead: NormalizedLead;
}

export async function ingestLead({ supabase, tenant_id, cliente_id, lead }: IngestParams) {
  // 1. Pipeline default do cliente
  const { data: pipeline } = await supabase
    .from("pipelines").select("id").eq("cliente_id", cliente_id).eq("is_default", true).maybeSingle();
  const { data: firstStage } = pipeline
    ? await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipeline.id).order("position").limit(1).maybeSingle()
    : { data: null };

  // 2. Match com veiculo do estoque (automotivo)
  let veiculo_id: string | null = null;
  if (lead.veiculo_external_id) {
    const { data: v } = await supabase.from("veiculos").select("id")
      .eq("cliente_id", cliente_id).eq("external_id", lead.veiculo_external_id).maybeSingle();
    veiculo_id = v?.id || null;
  }
  if (!veiculo_id && lead.modelo_interesse && lead.marca_interesse) {
    const { data: v } = await supabase.from("veiculos").select("id")
      .eq("cliente_id", cliente_id).eq("status", "disponivel")
      .ilike("marca", `%${lead.marca_interesse}%`).ilike("modelo", `%${lead.modelo_interesse}%`)
      .limit(1).maybeSingle();
    veiculo_id = v?.id || null;
  }

  // 3. Round-robin de vendedor
  const { data: vendedoresAtivos } = await supabase
    .from("vendedores").select("id")
    .eq("cliente_id", cliente_id).eq("is_active", true).order("id");
  let vendedor_id: string | null = null;
  if (vendedoresAtivos && vendedoresAtivos.length > 0) {
    // pega o vendedor com menos leads atribuidos no ultimo dia (round-robin balanceado)
    const since = new Date(Date.now() - 86400000).toISOString();
    const counts: Record<string, number> = {};
    for (const v of vendedoresAtivos) counts[v.id] = 0;
    const { data: recent } = await supabase
      .from("leads").select("vendedor_id")
      .eq("cliente_id", cliente_id).gte("vendedor_atribuido_at", since)
      .not("vendedor_id", "is", null);
    for (const r of recent || []) {
      if (r.vendedor_id) counts[r.vendedor_id] = (counts[r.vendedor_id] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
    vendedor_id = sorted[0]?.[0] || vendedoresAtivos[0].id;
  }

  // 4. Cria lead
  const { data: created, error } = await supabase.from("leads").insert({
    tenant_id, cliente_id,
    pipeline_id: pipeline?.id || null,
    stage_id: firstStage?.id || null,
    nome: lead.nome,
    email: lead.email,
    telefone: normalizePhone(lead.telefone),
    whatsapp: normalizePhone(lead.whatsapp || lead.telefone),
    cidade: lead.cidade,
    estado: lead.estado,
    origem: lead.origem,
    origem_detalhe: lead.origem_detalhe,
    source_url: lead.source_url,
    utm: lead.utm || {},
    fbclid: lead.fbclid,
    gclid: lead.gclid,
    veiculo_interesse_id: veiculo_id,
    modelo_interesse: lead.modelo_interesse,
    marca_interesse: lead.marca_interesse,
    ano_interesse: lead.ano_interesse,
    preco_max: lead.preco_max,
    vendedor_id,
    vendedor_atribuido_at: vendedor_id ? new Date().toISOString() : null,
    observacoes: lead.observacoes,
    metadata: { raw: lead.raw },
  }).select().single();

  if (error) throw new Error(error.message);

  // 5. Activity log
  await supabase.from("lead_activities").insert({
    lead_id: created.id, type: "created", content: `Lead capturado via ${lead.origem}`,
    metadata: { origem: lead.origem, origem_detalhe: lead.origem_detalhe },
  });

  // 6. Dispara automacoes (lead_created)
  const { data: automations } = await supabase
    .from("automations").select("*")
    .eq("cliente_id", cliente_id).eq("trigger", "lead_created").eq("is_active", true);

  for (const auto of automations || []) {
    try {
      await runAutomation(supabase, auto, created);
    } catch (e: unknown) {
      await supabase.from("automation_runs").insert({
        automation_id: auto.id, lead_id: created.id, status: "failed",
        error: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return created;
}

// ============================================================
// Executor de automacoes - simplificado, expande conforme acoes
// ============================================================
import { ZAPIClient } from "@/lib/integrations/zapi";
import { aiChat } from "@/lib/integrations/ai";

export async function runAutomation(
  supabase: SupabaseClient,
  automation: { id: string; tenant_id: string; cliente_id?: string; actions: { type: string; config: Record<string, unknown> }[]; conditions?: { field: string; op: string; value: unknown }[] },
  lead: Record<string, unknown>
) {
  // Avalia conditions
  for (const cond of automation.conditions || []) {
    const v = lead[cond.field];
    let pass = true;
    if (cond.op === "=") pass = v === cond.value;
    else if (cond.op === "in" && Array.isArray(cond.value)) pass = cond.value.includes(v);
    else if (cond.op === "!=") pass = v !== cond.value;
    if (!pass) return;
  }

  const output: Record<string, unknown> = {};

  for (const action of automation.actions || []) {
    try {
      switch (action.type) {
        case "send_message_whatsapp": {
          const tplCat = action.config.template_category as string | undefined;
          const body = (action.config.body as string) ||
            (await pickTemplateBody(supabase, automation.tenant_id, "whatsapp", tplCat)) ||
            "Oi {{nome}}, recebemos seu contato e ja vamos te ajudar!";
          const rendered = renderTemplate(body, lead);
          if (lead.whatsapp) {
            const zapi = new ZAPIClient();
            await zapi.sendText(String(lead.whatsapp), rendered);
            await supabase.from("lead_activities").insert({
              lead_id: lead.id, type: "message_out", content: rendered,
              metadata: { channel: "whatsapp", automation_id: automation.id },
            });
          }
          output.whatsapp = "sent";
          break;
        }
        case "run_ai_response": {
          const reply = await aiResponseForLead(supabase, lead);
          if (reply && lead.whatsapp) {
            const zapi = new ZAPIClient();
            await zapi.sendText(String(lead.whatsapp), reply);
            await supabase.from("lead_activities").insert({
              lead_id: lead.id, type: "message_out", content: reply,
              metadata: { channel: "whatsapp", source: "ia" },
            });
          }
          output.ai_reply = reply;
          break;
        }
        case "assign_round_robin": {
          if (!lead.vendedor_id) { /* ja foi feito no ingest */ }
          break;
        }
        case "move_stage": {
          await supabase.from("leads").update({ stage_id: action.config.stage_id as string }).eq("id", lead.id);
          break;
        }
        case "add_tag": {
          const tag = action.config.tag as string;
          const tags = [...((lead.tags as string[]) || []), tag];
          await supabase.from("leads").update({ tags }).eq("id", lead.id);
          break;
        }
        case "create_task": {
          // se precisar criar tarefa em board kanban
          break;
        }
        case "notify_user":
        case "escalate_to_manager":
        case "create_calendar_event":
        case "send_vehicle_photo":
        case "simulate_financing":
        case "webhook":
        default:
          // implementar progressivamente
          output[action.type] = "pending";
      }
    } catch (e: unknown) {
      output[action.type] = `error: ${e instanceof Error ? e.message : "erro"}`;
    }
  }

  await supabase.from("automation_runs").insert({
    automation_id: automation.id, lead_id: lead.id, status: "success", output,
  });
  await supabase.from("automations").update({
    run_count: 1, last_run_at: new Date().toISOString(),
  }).eq("id", automation.id);
}

async function pickTemplateBody(supabase: SupabaseClient, tenant_id: string, channel: string, category?: string) {
  if (!category) return null;
  const { data } = await supabase.from("followup_templates")
    .select("body").eq("tenant_id", tenant_id).eq("channel", channel).eq("category", category)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.body || null;
}

function renderTemplate(template: string, lead: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(lead[key] ?? ""));
}

async function aiResponseForLead(supabase: SupabaseClient, lead: Record<string, unknown>): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  // busca veiculo se houver
  let veiculoInfo = "";
  if (lead.veiculo_interesse_id) {
    const { data: v } = await supabase.from("veiculos").select("marca,modelo,ano,km,preco,combustivel,cambio,opcionais")
      .eq("id", lead.veiculo_interesse_id).maybeSingle();
    if (v) veiculoInfo = `Veiculo de interesse: ${v.marca} ${v.modelo} ${v.ano} - ${v.km}km - R$ ${v.preco} - ${v.combustivel} ${v.cambio}`;
  }

  const reply = await aiChat({
    systemPrompt: `Voce e um assistente de vendas amigavel e profissional. Responde leads de forma curta (max 2 paragrafos), pratica e que conduz a uma proxima acao (agendar visita, enviar fotos, qualificar interesse). Use linguagem natural brasileira. ${veiculoInfo}`,
    messages: [{ role: "user", content: `Lead recem capturado: nome=${lead.nome}, interesse=${lead.modelo_interesse || lead.observacoes}. Origem: ${lead.origem}. Faca uma mensagem de boas vindas curta e qualificadora.` }],
    temperature: 0.7,
    maxTokens: 300,
  });
  return reply;
}
