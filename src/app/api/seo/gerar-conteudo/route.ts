import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

/**
 * Gera conteudo SEO otimizado via Claude.
 * Body: { seo_project_id, type: 'blog_post'|'gmb_post', topic, keywords, length }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const body = await req.json();
  const { seo_project_id, type, topic, keywords, length } = body;

  const { data: project } = await supabase.from("seo_projects")
    .select("*,cliente:clientes(nome,segmento)").eq("id", seo_project_id).maybeSingle();
  if (!project) return new NextResponse("project nao encontrado", { status: 404 });

  const cliente = project.cliente as { nome?: string; segmento?: string } | null;
  const isBlogPost = type === "blog_post";

  const systemPrompt = isBlogPost
    ? `Voce escreve blog posts SEO otimizados pra PMEs brasileiras.
Regras:
- Escreve em portugues brasileiro natural.
- Use heading hierarchy (H1, H2, H3).
- Use o keyword principal no titulo, intro e 2-3 vezes no corpo, naturalmente.
- Inclua: intro com gancho, 3-5 subsecoes com H2, conclusao com CTA.
- ${length === "long" ? "Tamanho: 1500-2000 palavras." : length === "medium" ? "Tamanho: 800-1200 palavras." : "Tamanho: 400-600 palavras."}
- Devolva em markdown.
- No final, adicione: **Meta Title** (60 chars) e **Meta Description** (155 chars).`
    : `Voce escreve posts curtos pro Google Meu Negocio (GMB).
Regras:
- Tom direto, calorosos, brasileiro.
- 100-300 palavras.
- Comeca com pergunta ou estatistica que prenda.
- Termine com CTA claro (ligar, agendar, visitar).
- Adicione emoji moderado.`;

  const userMsg = `Cliente: ${cliente?.nome || "-"} (${cliente?.segmento || "-"})
Topico: ${topic}
Keywords alvo: ${keywords || "livre"}
Tom: ${project.tom_de_voz || "profissional, direto"}

Escreva o conteudo.`;

  try {
    const content = await aiChat({
      systemPrompt, messages: [{ role: "user", content: userMsg }],
      temperature: 0.6, maxTokens: length === "long" ? 4096 : 2048,
    });

    // salva como rascunho
    const { data: item } = await supabase.from("seo_content_items").insert({
      seo_project_id,
      type: type || "blog_post",
      title: topic,
      target_keywords: keywords ? keywords.split(",").map((k: string) => k.trim()) : [],
      body_html: content,
      status: "draft",
      generated_by_ai: true,
      ai_prompt: userMsg,
    }).select().single();

    return NextResponse.json({ content, item });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
