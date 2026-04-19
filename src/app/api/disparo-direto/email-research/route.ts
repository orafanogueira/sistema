import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";
import { sendEmail } from "@/lib/email/resend";

export const maxDuration = 800; // research demora

interface Contato {
  email?: string;
  nome?: string;
  name?: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  city?: string;
  state?: string;
  linkedin_url?: string;
  phone_numbers?: Array<{ raw_number: string }>;
}

interface Anexo {
  filename: string;
  content_url?: string;
}

interface ResearchResult {
  empresa: string;
  website?: string;
  resumo_site?: string;
  notícias?: string[];
  redes_sociais?: { instagram?: string; linkedin?: string };
  servicos_identificados?: string[];
  tamanho_aparente?: string;
}

const PROMPT_EMAIL_RESEARCH = `Você é o Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.
Gere um email B2B SUPER PERSONALIZADO pra esse contato, usando o research da empresa dele.

CONTEXTO SEU:
- +50 mil leads gerados, +10 mil carros vendidos em 2025
- +120 milhões em receita gerada com Meta Ads e Google Ads
- Foco em tráfego pago pra performance real

REGRAS CRÍTICAS:
- Assunto até 60 chars, desperta curiosidade SEM parecer spam
- Corpo em HTML simples (<p>), 6-10 linhas
- PERSONALIZE com detalhes REAIS da empresa (use o research fornecido)
- Mostre que você pesquisou: cite algo específico (serviço, nicho, cidade, diferencial)
- Gancho na primeira linha
- Ofereça insight baseado no que identificou sobre a empresa
- CTA leve: "Vale 15min?"
- NUNCA SEO/orgânico/rating — só tráfego pago
- Acentuação correta em português
- Tom: dono falando com dono, de igual pra igual

Retorne JSON estrito:
{"assunto":"...","corpo_html":"<p>...</p><p>...</p>"}`;

async function researchEmpresa(empresa: string, cidade?: string, linkedinUrl?: string): Promise<ResearchResult> {
  const serperKey = process.env.SERPER_API_KEY;
  const result: ResearchResult = { empresa };

  if (!serperKey) return result;

  try {
    const q = cidade ? `${empresa} ${cidade}` : empresa;
    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q, num: 5, gl: "br", hl: "pt-br" }),
    });

    if (r.ok) {
      const data = await r.json();
      const organic = (data.organic || []) as Array<{ title?: string; link?: string; snippet?: string }>;

      // tenta identificar website oficial (geralmente primeiro resultado não-social)
      const oficial = organic.find((o) => {
        const l = o.link || "";
        return !l.includes("instagram.com") && !l.includes("facebook.com") &&
               !l.includes("linkedin.com") && !l.includes("youtube.com");
      });

      if (oficial?.link) {
        result.website = oficial.link;
        result.resumo_site = oficial.snippet;

        // tenta scrapear a home
        try {
          const siteRes = await fetch(oficial.link, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          });
          if (siteRes.ok) {
            const html = await siteRes.text();
            // extrai texto de meta description + h1 + p (simplificado)
            const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1];
            const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
            if (metaDesc || h1) {
              result.resumo_site = [metaDesc, h1].filter(Boolean).join(" | ").slice(0, 400);
            }
          }
        } catch {}
      }

      // redes sociais
      const ig = organic.find((o) => o.link?.includes("instagram.com"));
      const li = organic.find((o) => o.link?.includes("linkedin.com"));
      result.redes_sociais = {
        instagram: ig?.link,
        linkedin: linkedinUrl || li?.link,
      };

      // resumo geral — primeiros 2 snippets
      const snippets = organic.slice(0, 3).map((o) => o.snippet).filter(Boolean);
      if (snippets.length > 0 && !result.resumo_site) {
        result.resumo_site = snippets.join(" · ").slice(0, 500);
      }
    }
  } catch {}

  return result;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const {
    contatos,
    anexos,
    nome_campanha,
    from_name,
    from_email,
    prompt_ia,
  }: {
    contatos: Contato[];
    anexos?: Anexo[];
    nome_campanha?: string;
    from_name?: string;
    from_email?: string;
    prompt_ia?: string;
  } = await req.json();

  if (!contatos || contatos.length === 0) return new NextResponse("contatos obrigatórios", { status: 400 });

  const validos = contatos.filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));

  if (validos.length === 0) {
    return NextResponse.json({ error: "nenhum contato com email válido", enviados: 0 });
  }

  // cria campanha
  const { data: campanha } = await supabase.from("email_campanhas").insert({
    tenant_id: m.tenant_id,
    nome: nome_campanha || `Apollo research ${new Date().toISOString().slice(0, 16)}`,
    prompt_ia: prompt_ia || PROMPT_EMAIL_RESEARCH,
    from_name: from_name || "Rafa Nogueira",
    from_email: from_email || "rafa@gruponogueiramkt.com",
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

  // prepara anexos (base64)
  const attachmentsResend: Array<{ filename: string; content: string }> = [];
  for (const a of anexos || []) {
    try {
      if (a.content_url) {
        const r = await fetch(a.content_url);
        const buf = await r.arrayBuffer();
        attachmentsResend.push({
          filename: a.filename,
          content: Buffer.from(buf).toString("base64"),
        });
      }
    } catch {}
  }

  let enviados = 0;
  let erros = 0;
  let pulados = 0;
  let pesquisados = 0;

  for (const contato of validos) {
    if (jaEnviadosSet.has(contato.email!)) { pulados++; continue; }

    const nome = contato.nome || contato.name || `${contato.first_name || ""} ${contato.last_name || ""}`.trim() || contato.email;
    const empresa = contato.organization_name || "";
    const cidade = [contato.city, contato.state].filter(Boolean).join(", ");
    const cargo = contato.title || "";

    // RESEARCH da empresa (Serper + scrape) — pula se não tiver empresa
    let research: ResearchResult = { empresa };
    if (empresa) {
      research = await researchEmpresa(empresa, cidade, contato.linkedin_url);
      pesquisados++;
    }

    // contexto rico pra IA
    const contextoCompleto = [
      nome ? `Contato: ${nome}` : "",
      cargo ? `Cargo: ${cargo}` : "",
      empresa ? `Empresa: ${empresa}` : "",
      cidade ? `Localização: ${cidade}` : "",
      contato.linkedin_url ? `LinkedIn: ${contato.linkedin_url}` : "",
      research.website ? `Website: ${research.website}` : "",
      research.resumo_site ? `Sobre a empresa (research): ${research.resumo_site}` : "",
      research.redes_sociais?.instagram ? `Instagram: ${research.redes_sociais.instagram}` : "",
    ].filter(Boolean).join("\n");

    // gera copy com IA usando o research
    let assunto = "";
    let corpo = "";
    try {
      const text = await aiChat({
        systemPrompt: prompt_ia || PROMPT_EMAIL_RESEARCH,
        messages: [{ role: "user", content: contextoCompleto || "Sem contexto" }],
        temperature: 0.85,
        maxTokens: 500,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        assunto = parsed.assunto || "";
        corpo = parsed.corpo_html || "";
      }
    } catch {}

    if (!assunto) assunto = empresa ? `Ideia rápida pra ${empresa}` : `Tenho uma ideia`;
    if (!corpo) corpo = `<p>Olá ${nome.split(" ")[0]}!</p><p>Vi a ${empresa || "sua empresa"} e tive uma ideia. Vale 15min pra conversarmos?</p><p>— Rafa Nogueira</p>`;

    // salva mensagem
    const { data: msgRow } = await supabase.from("email_mensagens").insert({
      tenant_id: m.tenant_id,
      campanha_id: campanha.id,
      email_destino: contato.email!,
      nome_destino: nome,
      empresa_destino: empresa || null,
      assunto,
      corpo_html: corpo,
      status: "pendente",
    }).select().single();

    // envia
    const result = await sendEmail({
      to: contato.email!,
      subject: assunto,
      html: corpo,
      from: `${from_name || "Rafa Nogueira"} <${from_email || "rafa@gruponogueiramkt.com"}>`,
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
          error_message: result.error || "erro",
        }).eq("id", msgRow.id);
      }
      erros++;
    }

    // intervalo 2s entre envios (research já dá tempo suficiente)
    await new Promise((r) => setTimeout(r, 2000));
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
    pesquisados,
    total: validos.length,
  });
}
