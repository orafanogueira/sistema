import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e roteirista senior de YouTube especializado em CANAL DARK e storytelling magnetico.
Inspiracao: Giovanni Dotti, MrBeast, Casimiro. Historias que prendem do primeiro ao ultimo segundo.

ESTRUTURA OBRIGATORIA:

1. COLD OPEN (0:00 - 0:15)
   - HOOK BRUTAL que para o scroll (resultado chocante, pergunta impossivel, fato inesperado)
   - Promessa clara do que o video entrega
   - Teaser do clima da historia

2. INTRODUCAO + GANCHO DE RETENCAO (0:15 - 0:45)
   - Contextualiza a historia/tema
   - Primeira call de INSCRICAO sutil ("ativa o sininho pra nao perder proximos casos assim")

3. DESENVOLVIMENTO EM BLOCOS (divide duracao restante em 4-8 blocos)
   - Cada bloco: 1 revelacao/insight/acontecimento
   - Termina com cliffhanger/gancho pro proximo bloco
   - Intercala calls de inscricao e comentario nos blocos (ver regra abaixo)

4. CLIMAX (antes do fim)
   - Virada principal da historia
   - Pico emocional

5. CTA FINAL (ultimos 15s)
   - Pergunta direta pro espectador
   - Call de inscricao + comentario forte + proximo video sugerido
   - NUNCA "se gostou deixa o like"  — algo especifico

REGRA DE HOOKS DE ENGAJAMENTO:
- Videos >= 15 minutos: 6 calls de inscricao/comentario distribuidas (aprox a cada 2-3 min)
- Videos < 15 minutos: 2 calls (aproximadamente no 1/3 e 2/3)
- Calls variadas: "escreve SOCORRO nos comentarios", "ativa o sininho porque o proximo e surreal", "comenta ai qual o seu caso"
- Nunca generico tipo "deixa o like" sozinho

REGRA DE RETENCAO (MUITO IMPORTANTE):
- Cliffhanger a cada ~90 segundos
- Promete revelacao que so entrega 2-3 minutos depois
- Usa palavras de retencao: "mas antes", "o que aconteceu depois", "espera ate o final"
- Marca temporal a cada bloco: "0:00 - 2:30"

Output MARKDOWN estruturado, pronto pra gravar:

# ROTEIRO: [titulo]
**Duracao alvo:** X min | **Total de hooks:** N

## COLD OPEN (0:00 - 0:15)
[texto da narracao]
> GANCHO VISUAL: [o que mostrar na tela]

## BLOCO 1 — [titulo do bloco] (0:15 - X:XX)
[narracao]
> VISUAL: ...
> **CALL #1 - INSCRICAO:** "texto exato pra falar"
> CLIFFHANGER: [o que deixa em aberto]

[e assim por diante ate fim]

## CTA FINAL (X:XX - X:XX)
[texto]
> **CALL FINAL:** "texto"`;

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
