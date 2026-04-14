import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processMessage } from "@/lib/rastreamento/keyword-engine";

/**
 * Endpoint que recebe mensagens do WhatsApp (Z-API webhook ou Meta Cloud webhook).
 * Registra em lead_messages + aciona keyword engine pra avancar jornada.
 *
 * Payload esperado (generico):
 * {
 *   cliente_token: "...",
 *   direction: "in" | "out",
 *   phone: "5511999999999",
 *   content: "texto da mensagem",
 *   external_id: "id msg na plataforma",
 *   channel: "whatsapp" | "messenger" | "instagram"
 * }
 */
export async function POST(req: Request) {
  const supabase = createServiceClient();
  const body = await req.json().catch(() => ({}));

  const { cliente_token, direction, phone, content, external_id, channel } = body;
  if (!cliente_token || !phone || !content) {
    return new NextResponse("params obrigatorios faltando", { status: 400 });
  }

  const { data: cliente } = await supabase
    .from("clientes").select("id, tenant_id")
    .eq("webhook_token", cliente_token).maybeSingle();
  if (!cliente) return new NextResponse("token invalido", { status: 404 });

  const normalizedPhone = phone.replace(/\D/g, "");

  // Encontra ou cria o lead
  let lead;
  const { data: existing } = await supabase.from("leads")
    .select("id,cliente_id").eq("cliente_id", cliente.id).eq("whatsapp", normalizedPhone)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (existing) {
    lead = existing;
  } else {
    const { data: novo } = await supabase.from("leads").insert({
      tenant_id: cliente.tenant_id, cliente_id: cliente.id,
      whatsapp: normalizedPhone, telefone: normalizedPhone,
      origem: "direto",
      status: "em_atendimento",
    }).select("id,cliente_id").single();
    lead = novo;
  }

  if (!lead) return new NextResponse("falha ao criar lead", { status: 500 });

  // Marca primeira_resposta_at se for 'out'
  if (direction === "out") {
    await supabase.from("leads")
      .update({ primeira_resposta_at: new Date().toISOString(), ultima_atividade_at: new Date().toISOString() })
      .eq("id", lead.id);
  }

  // Processa keywords
  const result = await processMessage({
    supabase, lead_id: lead.id, cliente_id: cliente.id, content, direction: direction || "in",
  });

  // Persiste a mensagem
  await supabase.from("lead_messages").insert({
    lead_id: lead.id,
    cliente_id: cliente.id,
    direction: direction || "in",
    channel: channel || "whatsapp",
    content,
    external_id,
    matched_keywords: result.matched_keywords,
    value_extracted: result.value_extracted,
  });

  return NextResponse.json({ ok: true, lead_id: lead.id, ...result });
}
