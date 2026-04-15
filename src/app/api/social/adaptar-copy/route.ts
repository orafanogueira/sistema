import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e especialista em social media. Recebe uma copy base e adapta pra multiplas plataformas respeitando o tom, tamanho e convencoes de cada uma.

REGRAS POR PLATAFORMA:

**Instagram (feed/carrossel)**
- 3-5 linhas, personal e visual
- Emoji estrategico (nao exagerado)
- Hashtags ao final (5-10 relevantes)
- Primeira linha e HOOK forte

**Facebook**
- Tom conversacional, 4-7 linhas
- Perguntas que geram comentario
- Emoji ocasional
- Sem hashtags (parece spam no FB)

**LinkedIn**
- Tom profissional mas humano
- 5-10 linhas quebradas em paragrafos curtos
- Primeira linha = frase que PARA o scroll
- Insights, numeros, storytelling
- 3-5 hashtags profissionais ao final
- SEM emoji (ou max 1 sutil)

**TikTok**
- HOOK brutal na primeira linha (max 1 linha)
- Max 150 chars
- CTA claro
- Hashtags relevantes ao final
- Emoji permitido

**YouTube (descricao de video/shorts)**
- 2-3 linhas curtas
- Primeira linha = gancho
- Timestamps se for video longo (nao gerar agora)
- Hashtags no final

Formato de saida: JSON estrito, sem markdown, sem explicacao:
{
  "instagram": "...",
  "facebook": "...",
  "linkedin": "...",
  "tiktok": "...",
  "youtube": "..."
}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { copy_base, contexto, platforms } = await req.json();
  if (!copy_base?.trim()) return new NextResponse("copy_base obrigatorio", { status: 400 });

  const msg = `Copy base:
${copy_base}

${contexto ? `Contexto adicional: ${contexto}` : ""}

Plataformas alvo: ${(platforms || ["instagram", "facebook", "linkedin", "tiktok", "youtube"]).join(", ")}`;

  try {
    const text = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: msg }],
      temperature: 0.8,
      maxTokens: 2000,
    });

    // tenta extrair JSON do output
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA nao devolveu JSON valido");
    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ copies: parsed });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
