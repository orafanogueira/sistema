import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";
import { sendEmail } from "@/lib/email/resend";

export const maxDuration = 300;

interface Contato {
  email?: string;
  nome?: string;
  username?: string;
  fullName?: string;
  biography?: string;
  businessCategory?: string;
}

interface Anexo {
  filename: string;
  content_url?: string;
  content_base64?: string;
}

const PROMPT_PADRAO = `Você é o Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.
Gere um email de prospecção B2B curto, pessoal, com gancho forte.

CONTEXTO:
- Especialista em Meta Ads e Google Ads
- +50 mil leads gerados, +10 mil carros vendidos em 2025
- +120 milhões em receita gerada

REGRAS:
- Assunto máximo 60 chars, desperta curiosidade, SEM parecer spam
- Corpo em HTML simples (<p>), 5-7 linhas
- Personaliza com nome/@ da pessoa
- Primeira linha = gancho (NUNCA "Tudo bem?", "Meu nome é")
- Oferece insight prático, não vende direto
- CTA leve: "Vale 15min pra te mostrar?"
- NUNCA fala de SEO, orgânico, rating
- Acentuação correta em português

Retorne JSON estrito:
{"assunto":"...","corpo_html":"<p>...</p><p>...</p>"}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const {
    contatos,
    prompt_ia,
    anexos,
    nome_campanha,
    from_name,
    from_email,
  }: {
    contatos: Contato[];
    prompt_ia?: string;
    anexos?: Anexo[];
    nome_campanha?: string;
    from_name?: string;
    from_email?: string;
  } = await req.json();

  if (!contatos || contatos.length === 0) return new NextResponse("contatos obrigatórios", { status: 400 });

  const validos = contatos.filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));

  if (validos.length === 0) {
    return NextResponse.json({ error: "nenhum contato com email válido", enviados: 0 });
  }

  // cria campanha
  const { data: campanha } = await supabase.from("email_campanhas").insert({
    tenant_id: m.tenant_id,
    nome: nome_campanha || `Disparo direto email ${new Date().toISOString().slice(0, 16)}`,
    prompt_ia: prompt_ia || PROMPT_PADRAO,
    from_name: from_name || "Grupo Nogueira",
    from_email: from_email || "contato@gruponogueiramkt.com",
    status: "ativa",
    total_emails: validos.length,
    created_by: user.id,
  }).select().single();

  // anti-duplicata
  const emails = validos.map((c) => c.email!);
  const { data: jaEnviados } = await supabase.from("email_mensagens")
    .select("email_destino")
    .in("email_destino", emails)
    .eq("tenant_id", m.tenant_id);
  const jaEnviadosSet = new Set((jaEnviados || []).map((x) => x.email_destino));

  // prepara anexos — se for URL, baixa e converte pra base64
  const attachmentsResend: Array<{ filename: string; content: string }> = [];
  for (const a of anexos || []) {
    try {
      let base64 = a.content_base64 || "";
      if (!base64 && a.content_url) {
        const r = await fetch(a.content_url);
        const buf = await r.arrayBuffer();
        base64 = Buffer.from(buf).toString("base64");
      }
      if (base64) {
        attachmentsResend.push({ filename: a.filename, content: base64 });
      }
    } catch {}
  }

  let enviados = 0;
  let erros = 0;
  let pulados = 0;

  for (const contato of validos) {
    if (jaEnviadosSet.has(contato.email!)) { pulados++; continue; }

    // gera copy com IA
    let assunto = "";
    let corpo = "";
    try {
      const contextoLead = [
        contato.nome || contato.fullName || contato.username ? `Nome: ${contato.nome || contato.fullName || contato.username}` : "",
        contato.businessCategory ? `Categoria: ${contato.businessCategory}` : "",
        contato.biography ? `Bio: ${contato.biography.slice(0, 150)}` : "",
      ].filter(Boolean).join("\n");

      const text = await aiChat({
        systemPrompt: prompt_ia || PROMPT_PADRAO,
        messages: [{ role: "user", content: contextoLead || "Sem contexto adicional" }],
        temperature: 0.9,
        maxTokens: 400,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        assunto = parsed.assunto || "";
        corpo = parsed.corpo_html || "";
      }
    } catch {}

    if (!assunto) assunto = `Ideia rápida pra ${contato.nome || contato.fullName || "você"}`;
    if (!corpo) corpo = `<p>Olá! Tive uma ideia que pode gerar resultado pro teu negócio.</p><p>Vale 15 minutos pra te mostrar?</p><p>— Rafa Nogueira</p>`;

    // registra no banco
    const { data: msgRow } = await supabase.from("email_mensagens").insert({
      tenant_id: m.tenant_id,
      campanha_id: campanha.id,
      email_destino: contato.email!,
      nome_destino: contato.nome || contato.fullName || contato.username || null,
      empresa_destino: contato.username || null,
      assunto,
      corpo_html: corpo,
      status: "pendente",
    }).select().single();

    // envia via Resend
    const result = await sendEmail({
      to: contato.email!,
      subject: assunto,
      html: corpo,
      from: `${from_name || "Grupo Nogueira"} <${from_email || "contato@gruponogueiramkt.com"}>`,
      attachments: attachmentsResend.length > 0 ? attachmentsResend : undefined,
    });

    if (result.sent) {
      if (msgRow?.id) {
        await supabase.from("email_mensagens").update({
          status: "enviado",
          sent_at: new Date().toISOString(),
        }).eq("id", msgRow.id);
      }
      enviados++;
    } else {
      if (msgRow?.id) {
        await supabase.from("email_mensagens").update({
          status: "erro",
          error_message: result.error || "erro desconhecido",
        }).eq("id", msgRow.id);
      }
      erros++;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  await supabase.from("email_campanhas").update({
    status: "concluida",
    total_enviados: enviados,
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
