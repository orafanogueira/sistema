import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

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
    .select("id,lead_id,tenant_id")
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
    } else if (transcriptLower.includes("não tenho interesse") || transcriptLower.includes("não quero")) {
      resultado = "sem_interesse";
    } else if (transcriptLower.includes("15 minutos") || transcriptLower.includes("consultoria") || transcriptLower.includes("agendar")) {
      resultado = "agendou";
    } else if (transcriptLower.includes("me liga") || transcriptLower.includes("retorna")) {
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
          status: "agendado",
          ultimo_contato: new Date().toISOString(),
        }).eq("id", lig.lead_id);
      } else if (resultado === "sem_interesse") {
        await supabase.from("prospeccao_leads").update({
          status: "sem_interesse",
          ultimo_contato: new Date().toISOString(),
        }).eq("id", lig.lead_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
