import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCall } from "@/lib/ligacoes/vapi";

export const maxDuration = 120;

/**
 * Sincroniza ligações com o Vapi quando o webhook não chegou.
 * Puxa status real de cada vapi_call_id das últimas 24h e atualiza:
 * - status, duracao, transcript, resumo_ia, resultado, custo
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  // pega TODAS as ligações dos últimos 7 dias que têm vapi_call_id e ainda não foram finalizadas
  // (ignora filtro de status — busca por qualquer que não tenha transcript salvo, indicando que não sincronizou)
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: ligacoes } = await supabase.from("ligacoes")
    .select("id, vapi_call_id, status, lead_id, tenant_id, telefone, nome, numero_id, transcript")
    .not("vapi_call_id", "is", null)
    .gte("created_at", seteDiasAtras)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!ligacoes || ligacoes.length === 0) {
    return NextResponse.json({ atualizadas: 0, mensagem: "Nenhuma ligação pendente pra sincronizar" });
  }

  let atualizadas = 0;
  let disparouFluxoPos = 0;
  const detalhes: Array<{ id: string; status?: string; resultado?: string; erro?: string }> = [];

  for (const lig of ligacoes) {
    try {
      const call = await getCall(lig.vapi_call_id);

      const transcript = call.transcript || "";
      const summary = call.summary || call.analysis?.summary;
      const endedReason = call.endedReason;
      const durationSec = call.endedAt && call.startedAt
        ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
        : undefined;

      // interpreta resultado
      let resultado = "atendida";
      const transcriptLower = transcript.toLowerCase();
      if (endedReason === "customer-did-not-answer" || endedReason === "no-answer") {
        resultado = "sem_resposta";
      } else if (endedReason === "silence-timed-out") {
        resultado = "silencio";
      } else if (transcriptLower.includes("não tenho interesse") || transcriptLower.includes("não quero") || transcriptLower.includes("para de ligar")) {
        resultado = "sem_interesse";
      } else if (
        transcriptLower.includes("pode mandar") ||
        transcriptLower.includes("manda no whatsapp") ||
        transcriptLower.includes("topo") ||
        transcriptLower.includes("aceito") ||
        transcriptLower.includes("tem whatsapp")
      ) {
        resultado = "agendou";
      } else if (transcriptLower.includes("me liga") || transcriptLower.includes("retorna")) {
        resultado = "callback";
      }

      const novoStatus = call.status === "ended" ? "atendida" :
        (resultado === "sem_resposta" ? "sem_resposta" : "atendida");

      await supabase.from("ligacoes").update({
        status: novoStatus,
        transcript: transcript || null,
        resumo_ia: summary || null,
        duracao_segundos: durationSec || null,
        resultado,
        custo_estimado: call.cost || null,
      }).eq("id", lig.id);

      atualizadas++;
      detalhes.push({ id: lig.id, status: novoStatus, resultado });

      // Se resultado = agendou, dispara fluxo pós-ligação (só se ainda não disparou)
      if (resultado === "agendou" && lig.lead_id) {
        const { count } = await supabase.from("disparo_mensagens")
          .select("*", { count: "exact", head: true })
          .eq("telefone_destino", lig.telefone)
          .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

        if (!count || count === 0) {
          // ainda não disparou - reprocessa manualmente
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ligacoes/reprocessar-pos`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie: "" },
              body: JSON.stringify({ ligacao_id: lig.id }),
            });
            disparouFluxoPos++;
          } catch {}
        }
      }

      // update status do lead no CRM
      if (lig.lead_id) {
        const statusLead = resultado === "agendou" ? "contato_feito" :
          resultado === "sem_interesse" ? "sem_interesse" :
          resultado === "sem_resposta" ? "nao_atendeu" : null;
        if (statusLead) {
          await supabase.from("prospeccao_leads").update({
            status: statusLead,
            ultimo_contato: new Date().toISOString(),
          }).eq("id", lig.lead_id);
        }
      }
    } catch (e: unknown) {
      detalhes.push({ id: lig.id, erro: e instanceof Error ? e.message : "erro" });
    }
  }

  return NextResponse.json({
    total: ligacoes.length,
    atualizadas,
    disparou_fluxo_pos: disparouFluxoPos,
    detalhes: detalhes.slice(0, 10),
  });
}
