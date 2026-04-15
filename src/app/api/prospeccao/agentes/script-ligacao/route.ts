import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

const SYSTEM = `Voce e especialista em prospeccao B2B por ligacao fria.
Gera script de ligacao pra agencia de marketing digital (Grupo Nogueira) abordar uma empresa.

Regras obrigatorias:
- Tom HUMANO, consultivo, nunca robotico ou de telemarketing
- Primeira frase precisa prender atencao em 3 segundos (sem "tudo bem?", "como vai?")
- Fazer pergunta especifica ligada ao contexto da empresa
- Quebrar 5 objecoes mais comuns com respostas curtas (max 2 linhas cada)
- Proposta de valor baseada em NUMEROS especificos (nao "temos mais de X clientes")
- Fechamento: pede 15 minutos, nao a venda

Formato de saida (markdown):

## Abertura (3 segundos pra nao desligar)
...

## Perguntas de qualificacao
1. ...
2. ...

## Proposta de valor
...

## Objecoes + Respostas
**"Ja tenho agencia"** — ...
**"Nao tenho verba"** — ...
**"Nao e prioridade agora"** — ...
**"Manda por email"** — ...
**"Nao tenho tempo"** — ...

## Fechamento
...`;

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
Categoria Google: ${lead.categoria || "nao informado"}
Rating Google: ${lead.rating || "sem rating"} com ${lead.reviews_count || 0} avaliacoes
Tem site proprio: ${lead.has_website ? "SIM" : "NAO"}

${!lead.has_website ? "OBS: Empresa NAO tem site — use isso como gancho." : ""}
${lead.rating && lead.rating >= 4.5 ? "OBS: Rating alto — use isso como elogio inicial." : ""}
${lead.reviews_count && lead.reviews_count > 100 ? "OBS: Muitos reviews — empresa estabelecida, use isso." : ""}`;

  try {
    const script = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: contexto }],
      temperature: 0.7,
      maxTokens: 1500,
    });
    return NextResponse.json({ script });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
