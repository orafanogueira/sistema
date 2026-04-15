import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e especialista em SEO de YouTube.
Gere descricao + bloco de tags pra video.

REGRAS OBRIGATORIAS:

DESCRICAO:
- Primeiras 2 linhas = HOOK (aparece no feed mobile, decide se clica)
- Repetir o TITULO DO VIDEO 2 vezes na descricao (inicio e meio) pra SEO
- Formatar com quebras de linha duplas entre secoes
- Incluir TODOS os links fornecidos com ancora magnetica (nao "clique aqui")
- Terminar com hashtags (3 a 5 relevantes)
- Entre 600 e 1500 caracteres

TAGS:
- Total ate 500 CARACTERES (somando tudo separado por virgula)
- Keyword principal primeiro (repetir variacoes)
- Long-tail variations
- LSI keywords (relacionadas semanticamente)
- Sinonimos e variacoes de ortografia
- Sem aspas, sem # (so palavras separadas por virgula)

Output JSON estrito:
{
  "descricao": "texto completo...",
  "tags": "tag1,tag2,tag3,...",
  "tags_chars": 487
}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { titulo, tema, links } = await req.json();
  if (!titulo?.trim()) return new NextResponse("titulo obrigatorio", { status: 400 });

  const linksTexto = Array.isArray(links) && links.length > 0
    ? links.map((l: { nome?: string; url?: string }) => `- ${l.nome || "Link"}: ${l.url}`).join("\n")
    : "(nenhum link fornecido)";

  const userMsg = `TITULO do video: ${titulo}
Tema/contexto: ${tema || titulo}

LINKS obrigatorios (inclua TODOS com ancora magnetica):
${linksTexto}`;

  try {
    const text = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.7,
      maxTokens: 2500,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA nao devolveu JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    // valida tags <= 500 chars
    if (parsed.tags && parsed.tags.length > 500) {
      parsed.tags = parsed.tags.slice(0, 500).replace(/,[^,]*$/, "");
    }
    parsed.tags_chars = parsed.tags?.length || 0;

    return NextResponse.json(parsed);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
