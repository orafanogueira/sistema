import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 120;

const SYSTEM = `Você é estrategista de social media sênior. Cria calendário editorial mensal completo.

REGRAS OBRIGATÓRIAS:
- Gere EXATAMENTE a quantidade de posts pedida (geralmente 20-30/mês)
- Distribua entre os pilares de conteúdo: autoridade, educativo, bastidores, venda, engajamento, entretenimento
- Distribua formatos: feed (40%), carrossel (25%), reels (25%), stories (10%)
- Cada post tem: data, formato, pilar, título (hook), briefing curto (2 linhas), hashtags sugeridas (5)
- Horários ideais: seg-sex 10h/14h/18h, sáb 11h, dom 15h
- Considere sazonalidade (feriados, datas comemorativas do mês)
- Respeite o nicho/vertical do cliente
- Use linguagem do público-alvo do cliente
- ACENTUAÇÃO CORRETA em português brasileiro

Output JSON estrito:
{
  "posts": [
    {
      "data": "2026-04-17",
      "horario": "14:00",
      "formato": "feed",
      "pilar": "autoridade",
      "plataformas": ["instagram", "linkedin"],
      "titulo": "Hook do post que prende atenção",
      "briefing": "Descrição curta do que o post aborda",
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
    }
  ]
}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { cliente_id, mes, ano, qtd_posts, nicho, tom_de_voz, observacoes } = await req.json();
  if (!cliente_id) return new NextResponse("cliente_id obrigatório", { status: 400 });

  const { data: cliente } = await supabase.from("clientes").select("nome,vertical").eq("id", cliente_id).maybeSingle();

  const mesNum = mes || new Date().getMonth() + 1;
  const anoNum = ano || new Date().getFullYear();
  const total = Math.min(qtd_posts || 20, 30);

  const userMsg = `Cliente: ${cliente?.nome || "Genérico"}
Vertical/nicho: ${nicho || cliente?.vertical || "comercial"}
Tom de voz: ${tom_de_voz || "profissional mas humano"}
Mês: ${mesNum}/${anoNum}
Quantidade de posts: ${total}
${observacoes ? `Observações: ${observacoes}` : ""}`;

  try {
    const text = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.8,
      maxTokens: 4000,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA não devolveu JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    const posts = parsed.posts || [];

    // salva cada post no DB como "agendado"
    let inserted = 0;
    for (const p of posts) {
      const scheduledFor = p.data && p.horario ? `${p.data}T${p.horario}:00` : null;
      const { error } = await supabase.from("social_posts").insert({
        tenant_id: m.tenant_id,
        cliente_id,
        platform: (p.plataformas || ["instagram"])[0],
        platforms: p.plataformas || ["instagram"],
        format: p.formato || "feed",
        pillar: p.pilar || "autoridade",
        status: "agendado",
        title: p.titulo,
        briefing: p.briefing,
        hashtags: (p.hashtags || []).map((h: string) => h.replace("#", "")),
        scheduled_for: scheduledFor,
        generated_by_agent: "calendario_ia",
        created_by: user.id,
      });
      if (!error) inserted++;
    }

    return NextResponse.json({ total_gerados: posts.length, total_salvos: inserted, posts });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
