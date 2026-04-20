import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findNextSlots } from "@/lib/google-calendar/client";
import { getValidToken } from "@/lib/google-calendar/token-manager";

export const maxDuration = 60;

/**
 * Reprocessa manualmente o fluxo pós-ligação:
 * - Busca horários no Calendar
 * - Manda WhatsApp pro lead
 * - Notifica o Rafa
 *
 * Usa quando o webhook Vapi falhou ou você quer re-executar.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { ligacao_id } = await req.json();
  if (!ligacao_id) return new NextResponse("ligacao_id obrigatório", { status: 400 });

  const { data: lig } = await supabase.from("ligacoes")
    .select("*")
    .eq("id", ligacao_id)
    .maybeSingle();

  if (!lig) return new NextResponse("ligação não encontrada", { status: 404 });

  const tenantId = lig.tenant_id;
  const telefoneLead = String(lig.telefone).replace(/\D/g, "");
  const telLead = telefoneLead.startsWith("55") ? telefoneLead : `55${telefoneLead}`;
  const nomeLead = lig.nome || "lead";

  let enviouWhatsapp = false;
  let notificouRafa = false;
  let horariosGerados: string[] = [];

  // 1. Pega slots do Google Calendar
  let slotsLabel = "";
  try {
    const token = await getValidToken(tenantId);
    if (token) {
      const slots = await findNextSlots(token.access_token, token.calendar_id, {
        durationMin: 15,
        count: 3,
      });
      slotsLabel = slots.map((s, i) => `${i + 1}) ${s.label}`).join("\n");
      horariosGerados = slots.map((s) => s.label);
    }
  } catch {}

  // 2. Busca Z-API ativo (liga usa numero Vapi, mas WhatsApp usa número ativo da tabela whatsapp_numeros)
  const { data: zapi } = await supabase.from("whatsapp_numeros")
    .select("id,zapi_instance_id,zapi_token").eq("is_active", true).limit(1).maybeSingle();

  if (!zapi?.zapi_instance_id || !zapi?.zapi_token) {
    return NextResponse.json({
      erro: "Nenhum número Z-API ativo encontrado. Cadastre em /disparo.",
      enviou_whatsapp: false,
      notificou_rafa: false,
    });
  }

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${zapi.zapi_instance_id}/token/${zapi.zapi_token}`;

  // 3. Envia msg pro lead
  const primeiroNome = nomeLead.split(" ")[0] || "";
  const saudacao = primeiroNome ? `Oi ${primeiroNome}!` : "Oi, tudo bom?";
  const mensagemLead = slotsLabel
    ? `${saudacao} Aqui é do Grupo Nogueira 🙌\n\nValeu pela conversa agora! Conforme combinado, olha as janelas que o Rafa tem essa semana pra conversar 15 min:\n\n${slotsLabel}\n\nQual funciona melhor pra você?`
    : `${saudacao} Aqui é do Grupo Nogueira. Valeu pela conversa! Me passa por aqui um horário bom pra você essa semana que o Rafa liga na call. Pode ser manhã ou tarde?`;

  try {
    const r = await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: telLead, message: mensagemLead }),
    });
    if (r.ok) {
      enviouWhatsapp = true;
      await supabase.from("disparo_mensagens").insert({
        tenant_id: tenantId,
        numero_id: zapi?.id || null,
        telefone_destino: telLead,
        nome_destino: nomeLead,
        mensagem_texto: mensagemLead,
        status: "enviado",
        sent_at: new Date().toISOString(),
      });
    }
  } catch {}

  // 4. Notifica Rafa
  const rafaPhone = (process.env.WHATSAPP_RAFA_PHONE || "5581984576173").replace(/\D/g, "");
  const resumoParaRafa = `🔔 *Reprocessamento manual da ligação*

👤 Lead: *${nomeLead}*
📱 Tel: ${telLead}
📞 Ligação: ${lig.id.slice(0, 8)}...

💬 Resumo da IA:
${(lig.resumo_ia || "").slice(0, 300)}

📅 Janelas enviadas pro lead:
${slotsLabel || "(calendário não conectado)"}

⚠️ Quando lead responder, a IA do WhatsApp vai te pedir confirmação antes de agendar.`;

  try {
    const r = await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: rafaPhone, message: resumoParaRafa }),
    });
    if (r.ok) notificouRafa = true;
  } catch {}

  return NextResponse.json({
    enviou_whatsapp: enviouWhatsapp,
    notificou_rafa: notificouRafa,
    horarios_gerados: horariosGerados,
    lead_telefone: telLead,
    rafa_telefone: rafaPhone,
  });
}
