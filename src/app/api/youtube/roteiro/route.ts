import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e roteirista senior de YouTube especializado em CANAL DARK e storytelling magnetico.
Inspiracao: Giovanni Dotti, MrBeast, Casimiro. Historias que prendem do primeiro ao ultimo segundo.

REGRAS DE FORMATO (OBRIGATORIO):
- Saida: TEXTO CORRIDO EM PROSA, em primeira/terceira pessoa dependendo do estilo
- ZERO titulos, ZERO topicos, ZERO marcacoes de tempo, ZERO markdown
- ZERO instrucoes visuais tipo "VISUAL:" ou "GANCHO:"
- ZERO numeracao de blocos
- Texto fluido pronto pra ser LIDO/NARRADO
- Paragrafos curtos (2-4 linhas cada) separados por quebra de linha dupla
- As calls de inscricao/comentario devem estar EMBUTIDAS no texto de forma natural, como se o narrador estivesse conversando

REGRAS DE CONTEUDO:

1. ABERTURA (primeiros paragrafos):
   - HOOK BRUTAL que para o scroll (resultado chocante, pergunta impossivel, fato inesperado)
   - Promessa clara do que o video entrega
   - Contextualiza a historia

2. DESENVOLVIMENTO:
   - Divide a historia em momentos (sem marcar explicitamente)
   - Cada momento termina com gancho/cliffhanger pro proximo
   - Usa frases de retencao: "mas antes", "o que aconteceu depois", "espera pra ver o que vem agora"
   - Intercala calls embutidas naturalmente

3. CLIMAX: virada principal, pico emocional

4. CTA FINAL: pergunta direta + call de inscricao + comentario especifico. NUNCA generico "deixa o like"

REGRA DE CALLS DE ENGAJAMENTO (INSCRICAO / COMENTARIO):
- Videos >= 15 minutos: 6 calls distribuidas ao longo do texto
- Videos < 15 minutos: 2 calls (aproximadamente 1/3 e 2/3)
- Embutir de forma NATURAL no texto, exemplo:
  - "...e se voce ta gostando ate aqui, deixa ja a inscricao porque o que vem agora e de cair o queixo. Continuando..."
  - "Aproveita e ja comenta ai qual voce faria no lugar dele, porque olha so o que aconteceu na sequencia..."
  - "...escreve SOCORRO ai nos comentarios se voce ja passou por algo parecido. Voltando pra historia..."
- Calls variadas, NUNCA "se gostou deixa o like" sozinho

EXEMPLO DO FORMATO DESEJADO (APENAS ESTILO, nao copiar conteudo):

"Ele ganhava mil e setecentos reais por mes como atendente de farmacia. Ano passado. Esse mes, ele passou de quarenta mil reais. E nao foi por sorte.

O nome dele e Lucas, tem vinte e tres anos, mora em Santa Catarina. Ha menos de um ano ele nao sabia que dava pra viver de YouTube. Hoje, ele tem quatro canais rodando.

E se voce acha que isso nao e pra voce, aproveita pra ja deixar a inscricao ativada, porque o que o Lucas descobriu quebra a logica que a maioria das pessoas acredita. Continuando...

Tudo comecou quando ele..."

GERA O ROTEIRO COMPLETO NESSE FORMATO CORRIDO. Pronto pra gravacao.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { titulo, duracao_min, tema, cta_final, cliente_id } = await req.json();
  if (!titulo?.trim()) return new NextResponse("titulo obrigatorio", { status: 400 });

  const dur = Math.max(3, Math.min(60, Number(duracao_min) || 10));
  const hooksCount = dur >= 15 ? 6 : 2;

  const userMsg = `Titulo do video: ${titulo}
Duracao alvo: ${dur} minutos
Total de calls de engajamento: ${hooksCount}
Tema/contexto: ${tema || "(derivar do titulo)"}
CTA final desejado: ${cta_final || "inscricao + comentario especifico + proximo video"}`;

  try {
    const roteiro = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.85,
      maxTokens: 4000,
    });

    // salva no historico
    if (cliente_id !== undefined) {
      await supabase.from("youtube_roteiros").insert({
        tenant_id: m.tenant_id,
        cliente_id: cliente_id || null,
        titulo, roteiro, duracao_min: dur,
        gerado_por: "roteiro_magnetico",
        created_by: user.id,
      });
    }

    return NextResponse.json({ roteiro, duracao_min: dur, hooks_esperados: hooksCount });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
