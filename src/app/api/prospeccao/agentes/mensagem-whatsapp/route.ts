import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e especialista em prospeccao B2B via WhatsApp.
Gera 3 VARIACOES de mensagem de abordagem fria pra uma empresa.
As 3 devem ter TOM/ESTRUTURA diferentes (pra rotacionar e evitar filtro de spam).

REGRAS OBRIGATORIAS (NAO QUEBRE):
- Cada variacao: maximo 3 linhas, maximo 280 caracteres
- Personalizar com NOME DA EMPRESA no cumprimento
- Fazer observacao ESPECIFICA (rating, reviews, sem site, etc)
- Oferecer INSIGHT nao servico — nunca "somos agencia de...", "vendemos..."
- Terminar com pergunta ABERTA (nao sim/nao, nao "posso te mandar?")
- Tom: humano, consultivo, curioso
- PROIBIDO: "tudo bem?", "como vai?", "podemos conversar?", "somos especialistas em..."
- Max 1 emoji por mensagem (ou nenhum)
- NAO use exclamacao exagerada
- NAO mencione preco ou agencia

Variacoes desejadas:
1. **Curiosidade**: provoca uma pergunta intrigante
2. **Elogio + insight**: parabeniza algo real + sugere ideia
3. **Direto ao ponto**: observacao seca + pergunta de valor

Formato de saida (markdown):

## Variacao 1 - Curiosidade
[texto da mensagem]

## Variacao 2 - Elogio + Insight
[texto da mensagem]

## Variacao 3 - Direto
[texto da mensagem]`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { lead_id } = await req.json();
  if (!lead_id) return new NextResponse("lead_id obrigatorio", { status: 400 });

  const { data: lead } = await supabase.from("prospeccao_leads")
    .select("nome,segmento,cidade,rating,reviews_count,has_website,categoria")
    .eq("id", lead_id).maybeSingle();
  if (!lead) return new NextResponse("lead nao encontrado", { status: 404 });

  const contexto = `Empresa: ${lead.nome}
Segmento: ${lead.segmento}
Cidade: ${lead.cidade}
Rating Google: ${lead.rating || "nao tem"} com ${lead.reviews_count || 0} avaliacoes
Tem site: ${lead.has_website ? "SIM" : "NAO"}`;

  try {
    const mensagens = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: contexto }],
      temperature: 0.9,
      maxTokens: 1200,
    });
    return NextResponse.json({ mensagens });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
