import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 300;

interface Contato {
  phone?: string;
  telefone?: string;
  nome?: string;
  username?: string;
  fullName?: string;
  biography?: string;
  businessCategory?: string;
}

interface Midia {
  tipo: "image" | "video" | "document";
  url: string;
  caption?: string;
  fileName?: string;
}

const PROMPT_PADRAO = `Você é o Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.
Gere uma mensagem de WhatsApp curta, pessoal, que desperte curiosidade.

CONTEXTO:
- Especialista em Meta Ads e Google Ads
- +50 mil leads gerados, +10 mil carros vendidos em 2025
- +120 milhões em receita gerada com tráfego pago

REGRAS:
- Primeira linha direta (sem "tudo bem?", "bom dia", "meu nome é")
- Usa o nome/@ da pessoa se disponível
- Maximo 3-4 linhas
- Tom: igual pra igual, confiante
- Termina com pergunta que gera resposta
- NUNCA fala de SEO, orgânico, rating
- Use acentuação correta em português

Retorne APENAS o texto da mensagem, sem aspas, sem explicação.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const {
    contatos,
    prompt_ia,
    midias,
    nome_campanha,
    numero_id,
  }: {
    contatos: Contato[];
    prompt_ia?: string;
    midias?: Midia[];
    nome_campanha?: string;
    numero_id?: string;
  } = await req.json();

  if (!contatos || contatos.length === 0) return new NextResponse("contatos obrigatórios", { status: 400 });

  // busca número ativo
  let numeroAtivo;
  if (numero_id) {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("id,zapi_instance_id,zapi_token").eq("id", numero_id).maybeSingle();
    numeroAtivo = data;
  } else {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("id,zapi_instance_id,zapi_token").eq("is_active", true).limit(1).maybeSingle();
    numeroAtivo = data;
  }

  if (!numeroAtivo?.zapi_instance_id || !numeroAtivo?.zapi_token) {
    return new NextResponse("nenhum número Z-API configurado", { status: 400 });
  }

  // cria campanha pra rastrear
  const { data: campanha } = await supabase.from("disparo_campanhas").insert({
    tenant_id: m.tenant_id,
    nome: nome_campanha || `Disparo direto ${new Date().toISOString().slice(0, 16)}`,
    status: "ativa",
    total_mensagens: contatos.length,
    created_by: user.id,
  }).select().single();

  // filtra só com telefone válido
  const validos = contatos.filter((c) => {
    const tel = String(c.phone || c.telefone || "").replace(/\D/g, "");
    return tel.length >= 10;
  });

  if (validos.length === 0) {
    return NextResponse.json({ error: "nenhum contato com telefone válido", enviados: 0 });
  }

  // anti-duplicata: pula quem já recebeu msg antes
  const telefones = validos.map((c) => String(c.phone || c.telefone || "").replace(/\D/g, ""));
  const { data: jaEnviados } = await supabase.from("disparo_mensagens")
    .select("telefone_destino")
    .in("telefone_destino", telefones)
    .eq("tenant_id", m.tenant_id);
  const jaEnviadosSet = new Set((jaEnviados || []).map((x) => x.telefone_destino));

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${numeroAtivo.zapi_instance_id}/token/${numeroAtivo.zapi_token}`;
  const zapiHeaders = { "Content-Type": "application/json", "Client-Token": clientToken };

  let enviados = 0;
  let erros = 0;
  let pulados = 0;

  for (const contato of validos) {
    const telLimpo = String(contato.phone || contato.telefone || "").replace(/\D/g, "");
    if (jaEnviadosSet.has(telLimpo)) { pulados++; continue; }

    // adiciona 55 se faltar
    const telFinal = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;

    // gera copy com IA
    let mensagem = "";
    try {
      const contextoLead = [
        contato.nome || contato.fullName || contato.username ? `Nome: ${contato.nome || contato.fullName || contato.username}` : "",
        contato.businessCategory ? `Categoria: ${contato.businessCategory}` : "",
        contato.biography ? `Bio: ${contato.biography.slice(0, 150)}` : "",
      ].filter(Boolean).join("\n");

      mensagem = await aiChat({
        systemPrompt: prompt_ia || PROMPT_PADRAO,
        messages: [{ role: "user", content: contextoLead || "Sem contexto adicional, gere mensagem genérica" }],
        temperature: 0.9,
        maxTokens: 250,
      });
    } catch {
      mensagem = `Oi! Vi teu perfil e tive uma ideia que pode gerar resultado pro teu negócio. Posso te mostrar?`;
    }

    if (!mensagem) { erros++; continue; }

    // registra mensagem no banco
    const { data: msgRow } = await supabase.from("disparo_mensagens").insert({
      tenant_id: m.tenant_id,
      campanha_id: campanha.id,
      numero_id: numeroAtivo.id,
      telefone_destino: telLimpo,
      nome_destino: contato.nome || contato.fullName || contato.username || null,
      mensagem_texto: mensagem,
      status: "pendente",
    }).select().single();

    // envia texto
    try {
      const r = await fetch(`${zapiBase}/send-text`, {
        method: "POST",
        headers: zapiHeaders,
        body: JSON.stringify({ phone: telFinal, message: mensagem }),
      });

      if (!r.ok) {
        const errTxt = await r.text();
        if (msgRow?.id) {
          await supabase.from("disparo_mensagens").update({
            status: "erro",
            error_message: `${r.status}: ${errTxt.slice(0, 200)}`,
          }).eq("id", msgRow.id);
        }
        erros++;
        continue;
      }

      // envia mídias se tiver
      for (const midia of midias || []) {
        const endpoint =
          midia.tipo === "image" ? "send-image" :
          midia.tipo === "video" ? "send-video" :
          "send-document";
        const payload: Record<string, unknown> = { phone: telFinal };
        if (midia.tipo === "image") payload.image = midia.url;
        if (midia.tipo === "video") payload.video = midia.url;
        if (midia.tipo === "document") {
          payload.document = midia.url;
          payload.fileName = midia.fileName || "arquivo.pdf";
        }
        if (midia.caption) payload.caption = midia.caption;

        try {
          await fetch(`${zapiBase}/${endpoint}`, {
            method: "POST",
            headers: zapiHeaders,
            body: JSON.stringify(payload),
          });
          await new Promise((r) => setTimeout(r, 1500));
        } catch {}
      }

      if (msgRow?.id) {
        await supabase.from("disparo_mensagens").update({
          status: "enviado",
          sent_at: new Date().toISOString(),
        }).eq("id", msgRow.id);
      }
      enviados++;
    } catch (e: unknown) {
      if (msgRow?.id) {
        await supabase.from("disparo_mensagens").update({
          status: "erro",
          error_message: e instanceof Error ? e.message : "erro desconhecido",
        }).eq("id", msgRow.id);
      }
      erros++;
    }

    // delay 5-15s entre envios (anti-bloqueio)
    const delay = 5000 + Math.random() * 10000;
    await new Promise((r) => setTimeout(r, delay));
  }

  await supabase.from("disparo_campanhas").update({
    status: "concluida",
    total_enviadas: enviados,
    total_erros: erros,
  }).eq("id", campanha.id);

  return NextResponse.json({
    campanha_id: campanha.id,
    enviados,
    erros,
    pulados,
    total: validos.length,
  });
}
