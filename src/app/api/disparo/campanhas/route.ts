import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 120;

const PROMPT_COPY = `Você é especialista em prospecção B2B via WhatsApp. Gere uma mensagem personalizada de abordagem fria.

REGRAS (NÃO QUEBRE):
- Máximo 3 linhas, máximo 280 caracteres
- Personalizar com NOME DA EMPRESA
- Fazer observação ESPECÍFICA (segmento, sem site, etc)
- Oferecer INSIGHT não serviço
- Terminar com pergunta ABERTA
- Tom: humano, consultivo. NUNCA "tudo bem?", "somos especialistas em..."
- Max 1 emoji
- ACENTUAÇÃO CORRETA em português

Output: APENAS o texto da mensagem.`;

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("disparo_campanhas")
    .select("*").order("created_at", { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { nome, lista_id, prompt_template, mensagem_padrao, intervalo_min_seg, intervalo_max_seg } = await req.json();
  if (!nome) return new NextResponse("nome obrigatório", { status: 400 });

  // cria campanha
  const { data: campanha, error } = await supabase.from("disparo_campanhas").insert({
    tenant_id: m.tenant_id,
    nome,
    lista_id: lista_id || null,
    prompt_template: prompt_template || PROMPT_COPY,
    mensagem_padrao: mensagem_padrao || null,
    intervalo_min_seg: intervalo_min_seg || 30,
    intervalo_max_seg: intervalo_max_seg || 90,
    created_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  // se tem lista, gera mensagens pra cada lead
  if (lista_id) {
    const { data: leads } = await supabase.from("prospeccao_leads")
      .select("id,nome,telefone,whatsapp,segmento,has_website,rating")
      .eq("lista_id", lista_id)
      .in("status", ["novo", "contato_feito"]);

    // pega números disponíveis pra rotação
    const { data: numeros } = await supabase.from("whatsapp_numeros")
      .select("id").eq("is_active", true);

    const msgs = [];
    let numIdx = 0;
    for (const lead of (leads || [])) {
      if (!lead.whatsapp && !lead.telefone) continue;

      // gera copy personalizado com IA
      let texto = mensagem_padrao || "";
      try {
        texto = await aiChat({
          systemPrompt: prompt_template || PROMPT_COPY,
          messages: [{ role: "user", content: `Empresa: ${lead.nome}\nSegmento: ${lead.segmento || "geral"}\nTem site: ${lead.has_website ? "sim" : "não"}\nRating: ${lead.rating || "sem"}` }],
          temperature: 0.9,
          maxTokens: 200,
        });
      } catch {
        texto = mensagem_padrao || `Olá! Vi a ${lead.nome} e queria compartilhar uma ideia rápida. Posso te contar?`;
      }

      const numeroId = numeros && numeros.length > 0 ? numeros[numIdx % numeros.length].id : null;
      numIdx++;

      msgs.push({
        tenant_id: m.tenant_id,
        campanha_id: campanha.id,
        lead_id: lead.id,
        numero_id: numeroId,
        telefone_destino: lead.whatsapp || lead.telefone,
        nome_destino: lead.nome,
        empresa_destino: lead.nome,
        texto_gerado: texto,
        position: msgs.length,
      });
    }

    if (msgs.length > 0) {
      await supabase.from("disparo_mensagens").insert(msgs);
      await supabase.from("disparo_campanhas").update({
        total_mensagens: msgs.length,
      }).eq("id", campanha.id);
    }

    return NextResponse.json({ campanha, total_mensagens: msgs.length });
  }

  return NextResponse.json({ campanha, total_mensagens: 0 });
}
