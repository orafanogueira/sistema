import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e especialista em titulos virais de YouTube no nicho de CANAL DARK (historias, curiosidades, listas, relacionamentos, financas, etc).

REFERENCIAS DE ESTRUTURA QUE VIRALIZAM (Dotti-style):
- Numero + beneficio/dor: "Como sai de R$1700 pra R$40.000/mes"
- Lista com curiosidade: "5 erros que destroem uma oficina"
- Revelacao: "Ninguem te conta que..."
- Contraste: "Estava falido. Hoje gano 100k. Fiz isso:"
- Pergunta provocativa: "Por que 90% dos canais Dark falham?"
- Story hook: "Ele ganhava 2000 por mes. Descobriu ISSO e mudou tudo"

REGRAS OBRIGATORIAS:
- Entre 50 e 70 caracteres (sweet spot YouTube)
- Palavra-chave principal nos PRIMEIROS 40 chars
- Curiosidade alta (deixa pergunta em aberto)
- Power words: ninguem, segredo, verdade, como, por que, ISSO, descobriu, revelou
- Proibido: clickbait mentiroso, "INCRIVEL", emoji exagerado, caps inteiro
- Se for reestruturacao de titulo existente: mudar ORDEM/ESTRUTURA mas manter intencao (fugir de copia)

NOTA SEO (0-100) considera:
- Tamanho ideal (55-65 chars = 100)
- Palavra-chave nos primeiros 40 chars (+20)
- Trigger word no inicio (+15)
- Numero presente (+10)
- Curiosidade gap (+15)

Output: JSON estrito, sem markdown:
{
  "titulos": [
    { "titulo": "...", "score_seo": 92, "analise": "palavra-chave bem posicionada, curiosidade forte" },
    ...
  ]
}
Gere 10 variacoes.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { tema, titulo_referencia, estilo } = await req.json();
  if (!tema?.trim() && !titulo_referencia?.trim()) {
    return new NextResponse("tema ou titulo_referencia obrigatorio", { status: 400 });
  }

  const userMsg = titulo_referencia
    ? `Tema: ${tema || "(extrair do titulo)"}
TITULO ORIGINAL (reestruturar mantendo intencao, mudar estrutura pra fugir de copia):
${titulo_referencia}

Estilo desejado: ${estilo || "canal dark storytelling"}`
    : `Tema: ${tema}
Estilo desejado: ${estilo || "canal dark storytelling"}`;

  try {
    const text = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.9,
      maxTokens: 2000,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("IA nao devolveu JSON valido");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
