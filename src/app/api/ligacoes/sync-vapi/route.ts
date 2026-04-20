import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getCall } from "@/lib/ligacoes/vapi";

export const maxDuration = 120;

/**
 * Sincroniza ligações com o Vapi quando o webhook não chegou.
 * Puxa status real de cada vapi_call_id das últimas 24h e atualiza:
 * - status, duracao, transcript, resumo_ia, resultado, custo
 */
export async function POST(req: Request) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  // busca tenant do user
  const { data: m } = await supabaseUser.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });
  const tenantId = m.tenant_id;

  // USA ADMIN CLIENT (bypass RLS) pra garantir leitura/escrita sem problemas
  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Parse opcional: se force=true, sincroniza TODAS (mesmo com transcript já salvo)
  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  // pega TODAS as ligações dos últimos 7 dias
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase.from("ligacoes")
    .select("id, vapi_call_id, status, lead_id, tenant_id, telefone, nome, numero_id, transcript")
    .eq("tenant_id", tenantId)
    .gte("created_at", seteDiasAtras)
    .order("created_at", { ascending: false })
    .limit(100);

  // Se não for force, só pega as que NÃO têm transcript ainda (pra não reprocessar toda hora)
  if (!force) {
    query = query.is("transcript", null);
  }

  const { data: ligacoes, error: errLig } = await query;

  if (errLig) {
    return NextResponse.json({ erro: errLig.message, atualizadas: 0 });
  }

  // Debug: conta quantas ligações existem no total vs quantas têm vapi_call_id
  const { count: totalLigacoes } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", seteDiasAtras);
  const { count: comVapiId } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .not("vapi_call_id", "is", null)
    .gte("created_at", seteDiasAtras);

  if (!ligacoes || ligacoes.length === 0) {
    return NextResponse.json({
      atualizadas: 0,
      debug: {
        total_ligacoes_7_dias: totalLigacoes || 0,
        com_vapi_call_id: comVapiId || 0,
        sem_vapi_call_id: (totalLigacoes || 0) - (comVapiId || 0),
      },
      mensagem: (totalLigacoes || 0) === 0
        ? "Nenhuma ligação nos últimos 7 dias"
        : (comVapiId || 0) === 0
        ? "Ligações existem mas nenhuma tem vapi_call_id salvo — bug no disparar-ia. Faça uma ligação nova pra testar."
        : "Todas as ligações já estão sincronizadas",
    });
  }

  let atualizadas = 0;
  let disparouFluxoPos = 0;
  const detalhes: Array<{ id: string; status?: string; resultado?: string; erro?: string }> = [];

  for (const lig of ligacoes) {
    // pula ligações sem vapi_call_id (não foram enviadas ao Vapi)
    if (!lig.vapi_call_id) {
      detalhes.push({ id: lig.id, erro: "sem vapi_call_id (ligação não foi disparada ao Vapi)" });
      continue;
    }

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

  // conta erros e mostra os primeiros 3 erros no response pra debug
  const erros = detalhes.filter((d) => d.erro);
  const primeiroErro = erros[0]?.erro;

  return NextResponse.json({
    total: ligacoes.length,
    atualizadas,
    erros: erros.length,
    disparou_fluxo_pos: disparouFluxoPos,
    primeiro_erro: primeiroErro || null,
    detalhes: detalhes.slice(0, 10),
  });
}
