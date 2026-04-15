import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e letrista profissional. Gera uma letra completa (verse + chorus + verse + chorus + bridge + chorus) baseada no tema/estilo pedido.

REGRAS:
- Estrutura padrao: [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Chorus]
- Marca cada secao com [Tag] em colchetes (Suno entende e divide)
- Refrao FORTE e memoravel
- Rimas naturais (nao forcadas)
- Letras com sentido emocional, nao genericas
- Idioma da letra conforme pedido pelo usuario (default: portugues)

Output: APENAS a letra com tags, sem explicacao.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { tema, estilo, idioma } = await req.json();
  if (!tema?.trim()) return new NextResponse("tema obrigatorio", { status: 400 });

  const userMsg = `Tema: ${tema}
Estilo musical: ${estilo || "pop emocional"}
Idioma: ${idioma || "portugues brasileiro"}`;

  try {
    const letra = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.85,
      maxTokens: 1500,
    });
    return NextResponse.json({ letra });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
