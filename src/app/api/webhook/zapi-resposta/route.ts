import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { aiChat } from "@/lib/integrations/ai";

/**
 * Webhook Z-API: recebe mensagens de resposta.
 * SÓ responde se o remetente é um lead de disparo.
 * Leads pessoais/grupos = ignora.
 */

const SYSTEM_NEGOCIADOR = `Você é o Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.

SEU OBJETIVO: levar esse lead do primeiro contato até o agendamento de reunião.

QUEM VOCÊ É:
- Especialista em Meta Ads e Google Ads pra lojas de veículos
- +50 mil leads gerados, +10 mil carros vendidos em 2025
- +120 milhões em receita gerada com tráfego pago

FUNIL DE NEGOCIAÇÃO (siga na ordem):
1. RESPONDEU → Agradeça, pergunte quantos carros vendem/mês e se já rodaram anúncio
2. QUALIFICADO → Entenda o cenário (quanto investem, quanto querem vender, região)
3. INTERESSADO → Compartilhe caso de sucesso similar, mostre que dá resultado
4. AGENDANDO → Proponha reunião de 15min: "Posso te mostrar em 15 minutos como funciona. Quando fica bom pra você?"
5. AGENDADO → Confirme data/hora, mande link (Google Meet) ou combine presencial

REGRAS:
- NUNCA mande preço por mensagem (só na reunião)
- NUNCA pareça robô — escreva como pessoa real, com gírias leves
- Frases CURTAS (1-3 linhas por mensagem)
- Se o lead disser "não tenho interesse" → responda educadamente e encerre
- Se perguntar preço → "Depende do seu cenário, cada loja é diferente. Em 15min te mostro exatamente quanto custa e quanto retorna."
- ACENTUAÇÃO CORRETA em português
- Provas sociais quando fizer sentido: https://www.instagram.com/p/DW1a5bZB6I0/

Responda APENAS com a mensagem de resposta, nada mais.`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Z-API envia: { phone, message: { text }, isGroup, fromMe }
  const phone = body.phone?.replace(/\D/g, "") || "";
  const text = body.message?.text || body.text?.message || body.body || "";
  const isGroup = body.isGroup || body.isGroupMsg || false;
  const fromMe = body.fromMe || false;

  // ignora: grupos, mensagens próprias, sem texto
  if (isGroup || fromMe || !text || !phone) {
    return NextResponse.json({ ignored: true });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "env" });

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // VERIFICA: esse telefone é de um lead de disparo?
  const { data: msgDisparo } = await supabase.from("disparo_mensagens")
    .select("id,lead_id,tenant_id,numero_id,campanha_id")
    .eq("telefone_destino", phone)
    .in("status", ["enviado", "respondido"])
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();

  // se NÃO é lead de disparo → ignora (não responde)
  if (!msgDisparo) {
    return NextResponse.json({ ignored: true, reason: "not_dispatch_lead" });
  }

  const tenantId = msgDisparo.tenant_id;
  const leadId = msgDisparo.lead_id;

  // marca como respondido
  if (msgDisparo.id) {
    await supabase.from("disparo_mensagens").update({
      status: "respondido",
      responded_at: new Date().toISOString(),
      response_text: text.slice(0, 500),
    }).eq("id", msgDisparo.id);

    // atualiza contadores da campanha
    await supabase.rpc("increment_field", {
      table_name: "disparo_campanhas",
      field_name: "total_respondidas",
      row_id: msgDisparo.campanha_id,
    }).then(() => {}).catch(() => {
      // fallback se rpc não existir
      supabase.from("disparo_campanhas")
        .update({ total_respondidas: 1 })
        .eq("id", msgDisparo.campanha_id);
    });
  }

  // salva mensagem do lead na conversa
  await supabase.from("disparo_conversas").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    mensagem_id: msgDisparo.id,
    telefone: phone,
    role: "user",
    content: text,
  });

  // busca histórico da conversa pra contexto
  const { data: historico } = await supabase.from("disparo_conversas")
    .select("role,content")
    .eq("telefone", phone)
    .order("created_at", { ascending: true })
    .limit(20);

  // busca info do lead
  const { data: lead } = leadId ? await supabase.from("prospeccao_leads")
    .select("nome,segmento,status")
    .eq("id", leadId).maybeSingle() : { data: null };

  // monta mensagens pro Claude
  const messages = (historico || []).map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));

  // gera resposta com IA
  let resposta = "";
  try {
    const contexto = lead ? `\n\nContexto: Lead ${lead.nome}, segmento ${lead.segmento}, etapa atual: ${lead.status}` : "";
    resposta = await aiChat({
      systemPrompt: SYSTEM_NEGOCIADOR + contexto,
      messages,
      temperature: 0.8,
      maxTokens: 300,
    });
  } catch {
    return NextResponse.json({ error: "ia_failed" });
  }

  if (!resposta) return NextResponse.json({ error: "empty_response" });

  // salva resposta da IA na conversa
  await supabase.from("disparo_conversas").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    mensagem_id: msgDisparo.id,
    telefone: phone,
    role: "assistant",
    content: resposta,
  });

  // detecta etapa do funil pela resposta e move lead
  const etapas: Record<string, string[]> = {
    qualificado: ["quantos carros", "quanto vendem", "quanto investem", "qual região"],
    interessado: ["caso de sucesso", "resultado", "mostr"],
    agendado: ["15 minutos", "reunião", "quando fica bom", "qual horário", "agenda"],
    perdido: ["não tenho interesse", "não quero", "para de mandar"],
  };

  let novaEtapa = "";
  const textoLower = (text + " " + resposta).toLowerCase();
  for (const [etapa, keywords] of Object.entries(etapas)) {
    if (keywords.some((k) => textoLower.includes(k))) {
      novaEtapa = etapa;
    }
  }

  if (novaEtapa && leadId) {
    const statusMap: Record<string, string> = {
      qualificado: "contato_feito",
      interessado: "agendado",
      agendado: "reuniao_realizada",
      perdido: "sem_interesse",
    };
    const newStatus = statusMap[novaEtapa];
    if (newStatus) {
      await supabase.from("prospeccao_leads").update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", leadId);
    }

    await supabase.from("prospeccao_atividades").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      tipo: "whatsapp",
      resultado: novaEtapa === "perdido" ? "nao_tem_interesse" : "atendeu",
      notas: `IA autoatendimento: ${novaEtapa}. Lead: "${text.slice(0, 80)}" → IA: "${resposta.slice(0, 80)}"`,
    });
  }

  // envia resposta via Z-API
  if (msgDisparo.numero_id) {
    const { data: numero } = await supabase.from("whatsapp_numeros")
      .select("zapi_instance_id,zapi_token")
      .eq("id", msgDisparo.numero_id).maybeSingle();

    if (numero?.zapi_instance_id && numero?.zapi_token) {
      const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
      await fetch(`https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": clientToken },
        body: JSON.stringify({ phone, message: resposta }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ responded: true, etapa: novaEtapa || "em_conversa" });
}
