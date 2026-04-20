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

FUNIL DE PRÉ-QUALIFICAÇÃO + AGENDAMENTO (siga na ordem, UMA pergunta por mensagem):

ETAPA 1 - PRIMEIRO CONTATO (lead respondeu algo):
- Agradeça de forma rápida e natural
- Pergunte: "Quantos carros vocês têm em estoque hoje?"

ETAPA 2 - ESTOQUE (lead respondeu quantidade):
- Confirme o número
- Pergunte: "Legal! E qual a média de vendas por mês?"

ETAPA 3 - VENDAS (lead respondeu média):
- Pergunte: "Vocês já investem em anúncios pagos (Meta Ads, Google)? Se sim, quanto mais ou menos?"

ETAPA 4 - INVESTIMENTO (lead respondeu sobre anúncios):
- Se já investe → "Entendi. Com [valor] vocês vendem [X]/mês. Nas lojas que atendo com investimento parecido, a média é [2-3x mais]. Por exemplo, uma loja com [estoque similar] saiu de [X] pra [3X] vendas/mês em 60 dias."
- Se não investe → "Então vocês vendem [X] carros só no orgânico? Imagina com anúncio pago qualificado. Tenho lojas parecidas que vendem [3-5x mais] com investimento a partir de R$ 3 mil/mês."
- Nos dois casos, finalize com: "Posso te mostrar em uma consultoria GRATUITA de 15 minutos exatamente como funciona pra uma loja do seu tamanho. Topa?"

ETAPA 5 - AGENDAMENTO (lead aceitou consultoria):
- NUNCA confirme horário direto. Diga: "Ótimo! Tenho 3 janelas abertas essa semana: terça 10h, quarta 14h, ou quinta 16h30. Qual encaixa melhor pra você?"
- Quando o lead escolher um horário: "Show! Anotei aqui — só vou confirmar com meu sócio e te mando o link da call. Te retorno em alguns minutos. 🙌"
- NUNCA confirme antes da confirmação do sócio/Rafa — sempre deixe em aberto pro Rafa validar.
- Se o lead propor outro horário fora das 3 janelas, mesma resposta: "Fechado! Vou confirmar com meu sócio e te retorno."

DADOS SEUS PRA COMPARAÇÃO (use naturalmente quando fizer sentido):
- Já gerou +50 mil leads pra lojas de veículos
- Média das lojas que atende: 40-80 carros vendidos/mês com tráfego
- Investimento médio dos clientes: R$ 5-15 mil/mês em ads
- ROI médio: 8-12x (investe 10k, retorna 80-120k em vendas)
- +10 mil carros vendidos em 2025 com anúncios pagos
- Prova: https://www.instagram.com/p/DW1a5bZB6I0/

REGRAS ABSOLUTAS:
- UMA pergunta por mensagem (nunca 2 perguntas juntas)
- Frases CURTAS (2-3 linhas máximo por mensagem)
- Tom: direto, confiante, como dono falando com dono
- NUNCA mande preço do serviço (só na consultoria)
- NUNCA pareça robô — fale como pessoa real
- Se lead disser "não tenho interesse" → "Sem problema! Se mudar de ideia, tô por aqui. Sucesso! 🤝" e encerra
- Se perguntar preço → "Cada loja é diferente, depende do cenário. Na consultoria gratuita te mostro exatamente quanto investir e quanto retorna."
- ACENTUAÇÃO CORRETA em português
- Provas sociais quando fizer sentido: https://www.instagram.com/p/DW1a5bZB6I0/

Responda APENAS com a mensagem de resposta, nada mais.`;

// GET: Z-API testa se URL tá ativa
export async function GET() {
  return NextResponse.json({ status: "ok", webhook: "zapi-resposta" });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Z-API envia vários formatos — captura tudo
  const phone = (body.phone || body.from || "").replace(/\D/g, "");
  const text = body.text?.message || body.message?.text || body.body || body.message || "";
  const isGroup = body.isGroup || body.isGroupMsg || body.chatName?.includes("@g.us") || false;
  const fromMe = body.fromMe || false;

  // ⚠️ SE A MENSAGEM É DO RAFA (confirmando agendamento pendente), trata diferente
  const rafaPhone = (process.env.WHATSAPP_RAFA_PHONE || "5581984576173").replace(/\D/g, "");
  if (phone === rafaPhone && !isGroup && text) {
    const resultadoConf = await processarConfirmacaoRafa(text);
    if (resultadoConf) {
      return NextResponse.json({ confirmacao_rafa: resultadoConf });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "env" });

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // LOG DE DEBUG: salva tudo que Z-API manda (pra diagnosticar)
  try {
    await supabase.from("disparo_conversas").insert({
      tenant_id: "00000000-0000-0000-0000-000000000000",
      telefone: phone || "sem_phone",
      role: "system",
      content: JSON.stringify({ phone, text, isGroup, fromMe, raw_keys: Object.keys(body) }).slice(0, 500),
    });
  } catch {}


  // ignora: grupos, mensagens próprias, sem texto
  if (isGroup || fromMe || !text || !phone) {
    return NextResponse.json({ ignored: true, phone, text: text?.slice(0, 50), isGroup, fromMe });
  }

  // VERIFICA: esse telefone é de um lead de disparo?
  // tenta match exato E parcial (últimos 10-11 dígitos)
  const phoneSuffix = phone.slice(-11); // DDD + número (sem código país)
  const { data: msgDisparo } = await supabase.from("disparo_mensagens")
    .select("id,lead_id,tenant_id,numero_id,campanha_id,telefone_destino")
    .in("status", ["enviado", "respondido"])
    .or(`telefone_destino.eq.${phone},telefone_destino.like.%${phoneSuffix}`)
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();

  // se NÃO é lead de disparo → ignora (não responde)
  if (!msgDisparo) {
    return NextResponse.json({ ignored: true, reason: "not_dispatch_lead", phone, phoneSuffix });
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
    try {
      await supabase.from("disparo_campanhas")
        .update({ total_respondidas: 1 })
        .eq("id", msgDisparo.campanha_id);
    } catch {}
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

  // INTEGRAÇÃO GOOGLE CALENDAR COM CONFIRMAÇÃO DO RAFA:
  // Quando o lead propõe horário, a IA NÃO agenda direto. Ela:
  // 1. Cria um registro em agendamentos_pendentes (status aguardando_rafa)
  // 2. Notifica o Rafa com o horário proposto + pergunta se pode agendar
  // 3. Responde ao lead: "Vou confirmar com o Rafa e te mando o link em instantes"
  // 4. Só quando o Rafa responder "SIM" (ou similar) no WhatsApp dele, o sistema cria o evento
  let respostaFinal = resposta;
  let agendamentoPendente: { id?: string; horario?: string } | null = null;

  const temHorarioProposto = /\d{1,2}\s?h|\d{1,2}:\d{2}|terça|quarta|quinta|sexta|segunda|sábado|domingo|amanhã|hoje/i.test(text);

  if (temHorarioProposto && (novaEtapa === "agendado" || textoLower.includes("confirma") || textoLower.includes("tá bom") || textoLower.includes("funciona"))) {
    try {
      // cria pendente aguardando confirmação do Rafa
      const { data: pend } = await supabase.from("agendamentos_pendentes").insert({
        tenant_id: tenantId,
        lead_id: leadId,
        mensagem_id: msgDisparo.id,
        telefone_lead: phone,
        nome_lead: lead?.nome || phone,
        horario_proposto_texto: text,
        status: "aguardando_rafa",
      }).select().single();

      agendamentoPendente = { id: pend?.id, horario: text };

      // responde ao lead dizendo que vai confirmar com o Rafa
      respostaFinal = `Perfeito! Só um instante enquanto eu confirmo com o Rafa se ele tem essa janela disponível. Te mando o link da call em instantes aqui. 🙌`;
    } catch {
      // se falhar criar pendente, deixa resposta original da IA
    }
  }

  // envia resposta via Z-API
  if (msgDisparo.numero_id) {
    const { data: numero } = await supabase.from("whatsapp_numeros")
      .select("zapi_instance_id,zapi_token")
      .eq("id", msgDisparo.numero_id).maybeSingle();

    if (numero?.zapi_instance_id && numero?.zapi_token) {
      const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";

      // responde pro lead (com mensagem do agendamento se houver)
      try {
        await fetch(`https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({ phone, message: respostaFinal }),
        });
      } catch {}

      // NOTIFICA RAFA: envia resumo pro grupo e/ou número pessoal
      const leadNome = lead?.nome || msgDisparo.telefone_destino || phone;

      // destaque especial quando está no passo de agendamento — precisa confirmar
      const precisaConfirmar = novaEtapa === "agendado" || /terça|quarta|quinta|sexta|segunda|sábado|domingo|\d{1,2}h|\d{1,2}:\d{2}|horário|agenda|marcar|reuni/i.test(text);

      let header = `🤖 *IA Autoatendimento*`;
      let acao = "";

      if (agendamentoPendente?.id) {
        // aguardando VOCÊ confirmar antes de criar evento
        header = `⚠️ *CONFIRMAÇÃO NECESSÁRIA — lead propôs horário*`;
        acao = `\n\n🕐 Horário proposto pelo lead:\n_"${text.slice(0, 150)}"_\n\n*👉 Responda AQUI com:*\n• *SIM* — pra confirmar e agendar no seu Calendar\n• *NÃO* — pra recusar\n• Um horário diferente (ex: "melhor terça 15h") — pra contra-propor\n\n_ID: ${agendamentoPendente.id.slice(0, 8)}_`;
      } else if (precisaConfirmar) {
        header = `⚠️ *CONFIRMAÇÃO NECESSÁRIA — IA pausou aguardando você*`;
        acao = `\n\n*👉 Responda aqui com o horário confirmado que eu repasso pro lead automaticamente.*`;
      }

      const resumo = `${header}\n\n👤 Lead: *${leadNome}*\n📱 Tel: ${phone}\n${novaEtapa ? `📊 Etapa: *${novaEtapa}*\n` : ""}\n💬 Lead disse: "${text.slice(0, 180)}"\n🤖 IA respondeu: "${respostaFinal.slice(0, 220)}"${acao}`;

      // envia pro grupo (via invite code)
      const inviteCode = process.env.WHATSAPP_GRUPO_NOTIFY;
      if (inviteCode) {
        try {
          const metaRes = await fetch(`https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}/invite-metadata/${inviteCode}`, {
            headers: { "Client-Token": clientToken },
          });
          if (metaRes.ok) {
            const meta = await metaRes.json();
            const groupPhone = meta.phone || meta.id || meta.chatId;
            if (groupPhone) {
              await fetch(`https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}/send-text`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Client-Token": clientToken },
                body: JSON.stringify({ phone: groupPhone, message: resumo }),
              });
            }
          }
        } catch {}
      }

      // envia pro número pessoal do Rafa
      const rafaPhone = process.env.WHATSAPP_RAFA_PHONE || "5581984576173";
      try {
        await fetch(`https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({ phone: rafaPhone, message: resumo }),
        });
      } catch {}
    }
  }

  return NextResponse.json({ responded: true, etapa: novaEtapa || "em_conversa" });
}

/**
 * Processa mensagens que vêm do número do Rafa pessoal.
 * Interpreta como confirmação/rejeição/contra-proposta de agendamentos pendentes.
 */
async function processarConfirmacaoRafa(textoRaw: string) {
  const texto = textoRaw.trim().toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // busca o agendamento pendente mais recente (últimos 24h)
  const vinte_e_quatro_h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pendente } = await supabase.from("agendamentos_pendentes")
    .select("*")
    .eq("status", "aguardando_rafa")
    .gte("created_at", vinte_e_quatro_h)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendente) return null;

  const { tenant_id, lead_id, telefone_lead, nome_lead, horario_proposto_texto } = pendente;

  // busca número Z-API ativo pra enviar mensagem pro lead
  const { data: numeroZapi } = await supabase.from("whatsapp_numeros")
    .select("zapi_instance_id,zapi_token")
    .eq("is_active", true).limit(1).maybeSingle();
  if (!numeroZapi) return null;

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${numeroZapi.zapi_instance_id}/token/${numeroZapi.zapi_token}`;

  // interpreta resposta do Rafa
  const confirmou = /\b(sim|confirma|confirmado|ok|pode|beleza|fechado|aprovado|confirmar)\b/i.test(texto);
  const rejeitou = /\b(não|nao|nope|nunca|recusa|cancela|rejeita)\b/i.test(texto);
  const temContraProposta = /\d{1,2}\s?h|\d{1,2}:\d{2}|terça|quarta|quinta|sexta|segunda|sábado|domingo|amanhã|melhor|prefiro/i.test(texto);

  // 1) CONFIRMOU → cria evento no Calendar + manda link pro lead
  if (confirmou && !rejeitou) {
    try {
      const agendarRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/agendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id,
          horario_texto: horario_proposto_texto,
          lead_nome: nome_lead,
          lead_telefone: telefone_lead,
          lead_id,
        }),
      });

      if (agendarRes.ok) {
        const data = await agendarRes.json();
        const mensagemProLead = data.mensagem_pro_lead || `Confirmado! Te mandei o link da call no horário combinado.`;

        // manda pro lead
        await fetch(`${zapiBase}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({ phone: telefone_lead, message: mensagemProLead }),
        });

        // atualiza pendente
        await supabase.from("agendamentos_pendentes").update({
          status: data.agendado ? "confirmado" : "rejeitado",
          confirmado_at: new Date().toISOString(),
          horario_proposto_iso: data.data_hora || null,
        }).eq("id", pendente.id);

        // confirma ao Rafa
        const rafaPhone = (process.env.WHATSAPP_RAFA_PHONE || "5581984576173").replace(/\D/g, "");
        await fetch(`${zapiBase}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({
            phone: rafaPhone,
            message: data.agendado
              ? `✅ Feito! Evento criado no Calendar e link enviado pro ${nome_lead}.\n\n🔗 ${data.meet_link}`
              : `⚠️ Horário ocupado na sua agenda. Sugeri outros horários pro lead escolher.`,
          }),
        });

        return { acao: "confirmado", agendado: data.agendado };
      }
    } catch {}
  }

  // 2) REJEITOU
  if (rejeitou && !confirmou && !temContraProposta) {
    await supabase.from("agendamentos_pendentes").update({
      status: "rejeitado",
      rejeitado_at: new Date().toISOString(),
    }).eq("id", pendente.id);

    // manda pro lead uma msg dizendo que tá consultando outro horário
    await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({
        phone: telefone_lead,
        message: `Poxa, esse horário não deu pro Rafa. Tem alguma outra janela que funciona pra você?`,
      }),
    });

    return { acao: "rejeitado" };
  }

  // 3) CONTRA-PROPOSTA: Rafa mandou outro horário
  if (temContraProposta) {
    await supabase.from("agendamentos_pendentes").update({
      status: "contra_proposta",
      observacoes: `Rafa sugeriu: ${textoRaw}`,
    }).eq("id", pendente.id);

    await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({
        phone: telefone_lead,
        message: `Oi, aquele horário não rolou pro Rafa, mas ele sugeriu: ${textoRaw}. Funciona pra você?`,
      }),
    });

    return { acao: "contra_proposta", horario: textoRaw };
  }

  return null;
}
