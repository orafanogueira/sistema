import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeOutboundCall, PROMPT_RAFA_PADRAO } from "@/lib/ligacoes/vapi";
import { pegarNumeroVapi, detectCountryFromPhone } from "@/lib/ligacoes/selecionar-numero";

export const maxDuration = 120;

interface Contato {
  telefone?: string;
  phone?: string;
  nome?: string;
  empresa?: string;
  lead_id?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const {
    contatos,
    nome_campanha,
    script,
    voice_id,
  }: {
    contatos: Contato[];
    nome_campanha?: string;
    script?: string;
    voice_id?: string;
  } = await req.json();

  if (!contatos || contatos.length === 0) return new NextResponse("contatos obrigatórios", { status: 400 });

  const validos = contatos.filter((c) => {
    const tel = String(c.telefone || c.phone || "").replace(/\D/g, "");
    return tel.length >= 10;
  });

  if (validos.length === 0) return NextResponse.json({ erro: "nenhum telefone válido", disparadas: 0 });

  // cria fila
  const { data: fila } = await supabase.from("ligacoes_filas").insert({
    tenant_id: m.tenant_id,
    nome: nome_campanha || `Ligações IA ${new Date().toISOString().slice(0, 16)}`,
    tipo: "ia_vapi",
    script: script || PROMPT_RAFA_PADRAO,
    voice_id: voice_id || "21m00Tcm4TlvDq8ikWAM", // Rachel (11labs)
    total_contatos: validos.length,
    status: "ativa",
    criado_por: user.id,
  }).select().single();

  const assistantConfig = {
    name: `Assistente Rafa - ${fila?.id?.slice(0, 6) || "default"}`,
    model: {
      provider: "openai" as const,
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: script || PROMPT_RAFA_PADRAO }],
      temperature: 0.7,
    },
    voice: {
      provider: "11labs" as const,
      voiceId: voice_id || "21m00Tcm4TlvDq8ikWAM",
    },
    firstMessage: "Oi, tudo bem? Aqui é a Ana, do Grupo Nogueira, posso falar rapidinho?",
    endCallMessage: "Obrigada pelo tempo! Qualquer coisa, tô por aqui. Até mais!",
    language: "pt-BR",
  };

  let disparadas = 0;
  let erros = 0;
  const detalhes: Array<{ telefone: string; status: string; call_id?: string; erro?: string }> = [];

  for (const contato of validos) {
    const telLimpo = String(contato.telefone || contato.phone || "").replace(/\D/g, "");
    // normaliza pra E.164 baseado no país detectado
    let telFinal: string;
    if (telLimpo.startsWith("55") && telLimpo.length >= 12) telFinal = `+${telLimpo}`;
    else if (telLimpo.startsWith("1") && telLimpo.length === 11) telFinal = `+${telLimpo}`;
    else if (telLimpo.length === 10 || telLimpo.length === 11) telFinal = `+55${telLimpo}`;
    else telFinal = `+${telLimpo}`;

    const paisDetectado = detectCountryFromPhone(telFinal);
    const numeroSelecionado = await pegarNumeroVapi(m.tenant_id, telFinal);

    if (!numeroSelecionado) {
      erros++;
      detalhes.push({ telefone: telLimpo, status: "erro", erro: "Nenhum número Vapi configurado" });
      continue;
    }

    // cria registro de ligação
    const { data: ligRow } = await supabase.from("ligacoes").insert({
      tenant_id: m.tenant_id,
      lead_id: contato.lead_id || null,
      fila_id: fila?.id,
      telefone: telLimpo,
      nome: contato.nome,
      tipo: "ia_vapi",
      status: "pendente",
      script_usado: script || PROMPT_RAFA_PADRAO,
      vapi_numero_id: numeroSelecionado.numeroId || null,
      created_by: user.id,
      observacoes: `País: ${paisDetectado} · Número Vapi: ${numeroSelecionado.fonte}`,
    }).select().single();

    try {
      const call = await makeOutboundCall({
        phone: telFinal,
        assistantConfig,
        phoneNumberId: numeroSelecionado.phoneNumberId,
        metadata: {
          ligacao_id: ligRow?.id,
          tenant_id: m.tenant_id,
          lead_nome: contato.nome,
          lead_empresa: contato.empresa,
          pais: paisDetectado,
        },
      });

      if (ligRow?.id) {
        await supabase.from("ligacoes").update({
          status: "em_andamento",
          vapi_call_id: call.id,
          realizada_em: new Date().toISOString(),
        }).eq("id", ligRow.id);
      }
      disparadas++;
      detalhes.push({ telefone: telLimpo, status: "em_andamento", call_id: call.id });
    } catch (e: unknown) {
      if (ligRow?.id) {
        await supabase.from("ligacoes").update({
          status: "erro",
          observacoes: e instanceof Error ? e.message : "erro",
        }).eq("id", ligRow.id);
      }
      erros++;
      detalhes.push({ telefone: telLimpo, status: "erro", erro: e instanceof Error ? e.message : "erro" });
    }

    // intervalo curto (Vapi controla paralelismo)
    await new Promise((r) => setTimeout(r, 1500));
  }

  return NextResponse.json({
    fila_id: fila?.id,
    disparadas,
    erros,
    total: validos.length,
    detalhes,
  });
}
