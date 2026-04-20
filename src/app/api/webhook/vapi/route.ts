import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { findNextSlots } from "@/lib/google-calendar/client";
import { getValidToken } from "@/lib/google-calendar/token-manager";

/**
 * Webhook Vapi.ai — recebe eventos de ligação
 * Configure em: https://dashboard.vapi.ai/settings/webhooks
 * URL: {NEXT_PUBLIC_APP_URL}/api/webhook/vapi
 */

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = body.message || body;
  const type = message.type || body.type;

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Pega call info
  const call = message.call || body.call || {};
  const callId = call.id || message.callId || body.callId;
  if (!callId) return NextResponse.json({ ignored: true });

  // Busca ligação pelo vapi_call_id
  const { data: lig } = await supabase.from("ligacoes")
    .select("id,lead_id,tenant_id,telefone,nome,numero_id")
    .eq("vapi_call_id", callId)
    .maybeSingle();

  if (!lig) return NextResponse.json({ ignored: true, reason: "ligacao_nao_encontrada" });

  // Status events
  if (type === "status-update") {
    const statusMap: Record<string, string> = {
      "queued": "pendente",
      "ringing": "em_andamento",
      "in-progress": "em_andamento",
      "forwarding": "em_andamento",
      "ended": "atendida",
    };
    const newStatus = statusMap[message.status || ""] || undefined;
    if (newStatus) {
      await supabase.from("ligacoes").update({ status: newStatus }).eq("id", lig.id);
    }
  }

  // End-of-call report — tem transcript, summary, duration
  if (type === "end-of-call-report") {
    const transcript = message.transcript || call.transcript;
    const summary = message.summary || call.summary;
    const endedReason = message.endedReason || call.endedReason;
    const durationSec = call.endedAt && call.startedAt
      ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
      : undefined;

    // interpreta resultado
    let resultado = "atendida";
    const transcriptLower = (transcript || "").toLowerCase();
    if (endedReason === "customer-did-not-answer" || endedReason === "no-answer") {
      resultado = "sem_resposta";
    } else if (transcriptLower.includes("não tenho interesse") || transcriptLower.includes("não quero") || transcriptLower.includes("para de ligar")) {
      resultado = "sem_interesse";
    } else if (
      transcriptLower.includes("pode mandar") ||
      transcriptLower.includes("manda no whatsapp") ||
      transcriptLower.includes("topo") ||
      transcriptLower.includes("aceito") ||
      transcriptLower.includes("pode sim") ||
      transcriptLower.includes("tem whatsapp") ||
      transcriptLower.includes("15 minut") ||
      transcriptLower.includes("consultoria")
    ) {
      resultado = "agendou"; // lead topou conversar via WhatsApp
    } else if (transcriptLower.includes("me liga") || transcriptLower.includes("retorna") || transcriptLower.includes("liga depois")) {
      resultado = "callback";
    }

    await supabase.from("ligacoes").update({
      status: resultado === "sem_resposta" ? "sem_resposta" : "atendida",
      transcript,
      resumo_ia: summary,
      duracao_segundos: durationSec,
      resultado,
      custo_estimado: call.cost || null,
    }).eq("id", lig.id);

    // registra atividade no CRM
    if (lig.lead_id) {
      await supabase.from("prospeccao_atividades").insert({
        tenant_id: lig.tenant_id,
        lead_id: lig.lead_id,
        tipo: "ligacao",
        resultado: resultado === "sem_interesse" ? "nao_tem_interesse" : (resultado === "agendou" ? "agendou" : "atendeu"),
        notas: `Ligação IA (${durationSec}s). Resumo: ${(summary || "").slice(0, 300)}`,
      });

      // se agendou, atualiza status do lead
      if (resultado === "agendou") {
        await supabase.from("prospeccao_leads").update({
          status: "contato_feito",
          ultimo_contato: new Date().toISOString(),
        }).eq("id", lig.lead_id);
      } else if (resultado === "sem_interesse") {
        await supabase.from("prospeccao_leads").update({
          status: "sem_interesse",
          ultimo_contato: new Date().toISOString(),
        }).eq("id", lig.lead_id);
      }
    }

    // 🔔 FLUXO PÓS-LIGAÇÃO: se lead topou conversar, dispara WhatsApp com horários + notifica Rafa
    if (resultado === "agendou" && lig.telefone) {
      await dispararFluxoPosLigacao({
        supabase,
        tenantId: lig.tenant_id,
        telefoneLeadRaw: lig.telefone,
        nomeLead: lig.nome || "lead",
        ligacaoId: lig.id,
        resumoIA: summary || "",
        numeroId: lig.numero_id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Depois da ligação IA, se o lead topou conversar:
 * 1. Consulta Google Calendar e pega 3 próximos horários livres
 * 2. Manda WhatsApp pro lead com os horários (via Z-API)
 * 3. Notifica Rafa sobre a ligação concluída (pede confirmação final dos horários)
 */
async function dispararFluxoPosLigacao(params: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  tenantId: string;
  telefoneLeadRaw: string;
  nomeLead: string;
  ligacaoId: string;
  resumoIA: string;
  numeroId?: string | null;
}) {
  const { supabase, tenantId, telefoneLeadRaw, nomeLead, ligacaoId, resumoIA, numeroId } = params;

  // 1. Pega próximos 3 horários livres do Google Calendar
  let slotsLabel = "";
  let slots: Array<{ startISO: string; label: string }> = [];
  try {
    const token = await getValidToken(tenantId);
    if (token) {
      slots = await findNextSlots(token.access_token, token.calendar_id, {
        durationMin: 15,
        count: 3,
      });
      slotsLabel = slots.map((s, i) => `${i + 1}) ${s.label}`).join("\n");
    }
  } catch {}

  // 2. Monta mensagem pro lead
  const primeiroNome = (nomeLead || "").split(" ")[0] || "";
  const saudacao = primeiroNome ? `Oi ${primeiroNome}!` : "Oi, tudo bom?";
  const mensagemLead = slotsLabel
    ? `${saudacao} Aqui é do Grupo Nogueira 🙌\n\nValeu pela conversa agora! Conforme combinado, olha as janelas que o Rafa tem essa semana pra conversar 15 min:\n\n${slotsLabel}\n\nQual funciona melhor pra você?`
    : `${saudacao} Aqui é do Grupo Nogueira. Valeu pela conversa! Me passa por aqui um horário bom pra você essa semana que o Rafa liga na call. Pode ser manhã ou tarde?`;

  // 3. Busca número Z-API pra enviar mensagem
  let zapiData;
  if (numeroId) {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("zapi_instance_id,zapi_token").eq("id", numeroId).maybeSingle();
    zapiData = data;
  } else {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("zapi_instance_id,zapi_token").eq("is_active", true).limit(1).maybeSingle();
    zapiData = data;
  }

  if (!zapiData?.zapi_instance_id || !zapiData?.zapi_token) return;

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${zapiData.zapi_instance_id}/token/${zapiData.zapi_token}`;

  // normaliza telefone pra formato sem +
  let telLead = telefoneLeadRaw.replace(/\D/g, "");
  if (!telLead.startsWith("55") && (telLead.length === 10 || telLead.length === 11)) {
    telLead = `55${telLead}`;
  }

  // 4. Envia msg pro lead
  try {
    await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: telLead, message: mensagemLead }),
    });

    // registra no disparo_mensagens pra IA autoatendimento assumir a conversa
    await supabase.from("disparo_mensagens").insert({
      tenant_id: tenantId,
      numero_id: numeroId || null,
      telefone_destino: telLead,
      nome_destino: nomeLead,
      mensagem_texto: mensagemLead,
      status: "enviado",
      sent_at: new Date().toISOString(),
    });
  } catch {}

  // 5. Notifica Rafa (aguardando confirmação dele antes de confirmar com lead)
  const resumoParaRafa = `🔔 *Lead topou após ligação IA*

👤 Lead: *${nomeLead}*
📱 Tel: ${telLead}
📞 Ligação: ${ligacaoId.slice(0, 8)}...

💬 Resumo da IA:
${resumoIA.slice(0, 300)}

📅 Janelas enviadas pro lead:
${slotsLabel || "(calendário não conectado)"}

${slotsLabel
  ? "⚠️ *Quando lead responder um horário, a IA do WhatsApp vai confirmar com você aqui antes de agendar no Calendar.*"
  : "⚠️ *Google Calendar não conectado — conecta em /configuracoes/calendar pra agendar automaticamente.*"
}`;

  const rafaPhone = process.env.WHATSAPP_RAFA_PHONE || "5581984576173";
  try {
    await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: rafaPhone, message: resumoParaRafa }),
    });
  } catch {}
}
