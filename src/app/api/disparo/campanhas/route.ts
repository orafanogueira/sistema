import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 120;

const PROMPT_COPY = `Você é o Rafa Nogueira, gestor de TRÁFEGO PAGO do Grupo Nogueira — agência de performance digital. Gere mensagem de prospecção B2B via WhatsApp.

CONTEXTO DO REMETENTE (use naturalmente, NÃO despeje tudo):
- Especialista em TRÁFEGO PAGO (Meta Ads, Google Ads)
- +50 mil leads gerados pra lojas de veículos
- +10 mil carros vendidos em 2025 com tráfego pago
- +120 milhões em receita gerada pra clientes
- Foco: resultado REAL com anúncios pagos, não orgânico

REGRAS (NÃO QUEBRE):
- Máximo 3 linhas, máximo 280 caracteres
- Personalizar com NOME DA EMPRESA
- Observação ESPECÍFICA sobre o negócio (rating alto, muitos reviews, poucas avaliações, sem site, etc)
- Falar de TRÁFEGO PAGO / ANÚNCIOS / LEADS — nunca de SEO, orgânico, redes sociais
- Mencionar resultado concreto (ex: "ajudei lojas parecidas a vender X carros/mês com anúncio")
- Terminar com pergunta ABERTA que gera curiosidade
- Tom: direto, confiante, de igual pra igual. Como um colega de mercado, não vendedor
- NUNCA: "tudo bem?", "podemos conversar?", "somos especialistas", "captação digital"
- Max 1 emoji
- ACENTUAÇÃO CORRETA em português

Output: APENAS o texto da mensagem, nada mais.`;

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

  const { nome, lista_id, prompt_template, mensagem_padrao, intervalo_min_seg, intervalo_max_seg, numero_ids } = await req.json();
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
    // busca TODOS os leads da lista (sem filtro de status)
    const { data: leads } = await supabase.from("prospeccao_leads")
      .select("id,nome,telefone,whatsapp,segmento,has_website,rating,status")
      .eq("lista_id", lista_id);

    // pega números pra rotação (selecionados OU todos ativos)
    let numerosQuery = supabase.from("whatsapp_numeros").select("id").eq("is_active", true);
    if (Array.isArray(numero_ids) && numero_ids.length > 0) {
      numerosQuery = numerosQuery.in("id", numero_ids);
    }
    const { data: numeros } = await numerosQuery;

    // se nenhum número, busca todos ativos como fallback
    if (!numeros || numeros.length === 0) {
      const { data: allNumeros } = await supabase.from("whatsapp_numeros").select("id").eq("is_active", true);
      if (allNumeros && allNumeros.length > 0) {
        numeros?.push(...allNumeros);
      }
    }

    const msgs = [];
    let numIdx = 0;
    for (const lead of (leads || [])) {
      const tel = lead.whatsapp || lead.telefone;
      if (!tel) continue;

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
        telefone_destino: tel,
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

    // retorna campanha com total atualizado
    const campanhaAtualizada = { ...campanha, total_mensagens: msgs.length };

    return NextResponse.json({
      campanha: campanhaAtualizada,
      total_mensagens: msgs.length,
      debug: {
        leads_na_lista: (leads || []).length,
        leads_com_telefone: (leads || []).filter((l) => l.whatsapp || l.telefone).length,
        numeros_selecionados: (numeros || []).length,
      },
    });
  }

  return NextResponse.json({ campanha, total_mensagens: 0, debug: { leads_na_lista: 0 } });
}
