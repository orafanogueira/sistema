import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e editor de video senior especialista em conteudo pra redes sociais (Reels/TikTok/Shorts).

Dado um briefing (produto, objetivo, duracao, plataforma), gera:

1. **Gancho (primeiros 3 segundos)** — frase/acao que para o scroll
2. **Estrutura narrativa** — dividida em segmentos com durações (total = duracao pedida)
3. **Roteiro de edicao** — corte a corte, o que mostrar, texto na tela, voz over
4. **B-rolls sugeridos** — imagens/videos de apoio
5. **Trilha sonora** — estilo + sugestao de busca (Epidemic Sound, YouTube Audio Library)
6. **Legendas** — 5-7 legendas curtas que aparecem durante o video (1 por segmento)
7. **CTA final** — ultimos 3 segundos
8. **Prompt pra IA de video** — se quiser gerar cenas com Runway/Pika/Sora, texto pronto

Formato markdown limpo, sem floreios.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { briefing, duracao_seg, plataforma } = await req.json();
  if (!briefing?.trim()) return new NextResponse("briefing obrigatorio", { status: 400 });

  const msg = `Briefing: ${briefing}
Duracao: ${duracao_seg || 30} segundos
Plataforma: ${plataforma || "instagram_reels"}`;

  try {
    const text = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: msg }],
      temperature: 0.8,
      maxTokens: 2500,
    });
    return NextResponse.json({ roteiro: text });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
