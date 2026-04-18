import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 120;

const PROMPT_EMAIL = `Você é especialista em cold email B2B. Gere um email de prospecção personalizado.

REGRAS:
- Assunto: máximo 60 chars, curiosidade alta, NÃO parece spam
- Corpo: 5-8 linhas, HTML simples (parágrafos com <p>)
- Personalizar com nome da empresa
- Primeira linha = gancho (não "Tudo bem?", "Meu nome é...")
- Oferecer insight, não vender
- CTA claro mas leve (ex: "Vale 15min pra te mostrar?")
- Tom profissional mas humano
- ACENTUAÇÃO CORRETA em português

Output JSON estrito:
{
  "assunto": "...",
  "corpo_html": "<p>...</p><p>...</p>"
}`;

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("email_campanhas")
    .select("*").order("created_at", { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { nome, lista_id, assunto_template, corpo_template, prompt_ia } = await req.json();
  if (!nome) return new NextResponse("nome obrigatório", { status: 400 });

  const { data: campanha, error } = await supabase.from("email_campanhas").insert({
    tenant_id: m.tenant_id, nome,
    lista_id: lista_id || null,
    assunto_template: assunto_template || null,
    corpo_template: corpo_template || null,
    prompt_ia: prompt_ia || PROMPT_EMAIL,
    created_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  if (lista_id) {
    const { data: leads } = await supabase.from("prospeccao_leads")
      .select("id,nome,email,telefone,segmento,has_website,rating")
      .eq("lista_id", lista_id);

    const msgs = [];
    for (const lead of (leads || [])) {
      if (!lead.email) continue;

      let assunto = assunto_template || "";
      let corpo = corpo_template || "";

      if (!assunto || !corpo) {
        try {
          const text = await aiChat({
            systemPrompt: prompt_ia || PROMPT_EMAIL,
            messages: [{ role: "user", content: `Empresa: ${lead.nome}\nSegmento: ${lead.segmento || "geral"}\nTem site: ${lead.has_website ? "sim" : "não"}` }],
            temperature: 0.9,
            maxTokens: 400,
          });
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            assunto = parsed.assunto || assunto;
            corpo = parsed.corpo_html || corpo;
          }
        } catch {
          assunto = assunto || `Ideia rápida pra ${lead.nome}`;
          corpo = corpo || `<p>Olá! Reparei na ${lead.nome} e tive uma ideia que pode ajudar.</p><p>Vale 15 minutos pra te mostrar?</p>`;
        }
      } else {
        assunto = assunto.replace(/\{\{empresa\}\}/g, lead.nome);
        corpo = corpo.replace(/\{\{empresa\}\}/g, lead.nome).replace(/\{\{nome\}\}/g, lead.nome);
      }

      msgs.push({
        tenant_id: m.tenant_id,
        campanha_id: campanha.id,
        lead_id: lead.id,
        email_destino: lead.email,
        nome_destino: lead.nome,
        empresa_destino: lead.nome,
        assunto, corpo_html: corpo,
        position: msgs.length,
      });
    }

    if (msgs.length > 0) {
      await supabase.from("email_mensagens").insert(msgs);
      await supabase.from("email_campanhas").update({ total_emails: msgs.length }).eq("id", campanha.id);
    }

    return NextResponse.json({
      campanha: { ...campanha, total_emails: msgs.length },
      total_emails: msgs.length,
      debug: {
        leads_na_lista: (leads || []).length,
        leads_com_email: (leads || []).filter((l) => l.email).length,
      },
    });
  }

  return NextResponse.json({ campanha, total_emails: 0 });
}
