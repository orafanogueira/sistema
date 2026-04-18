import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 120;

const PROMPT_COPY = `Você é o Rafa Nogueira, gestor de TRÁFEGO PAGO do Grupo Nogueira. Gere mensagem de prospecção via WhatsApp.

QUEM VOCÊ É:
- Gestor de tráfego pago (Meta Ads e Google Ads)
- Já gerou +50 mil leads pra lojas de veículos
- Já ajudou a vender +10 mil carros em 2025 com anúncios pagos
- +120 milhões em receita gerada com tráfego pago

ESTRUTURA DA MENSAGEM (3 partes):
1. Cumprimento direto com nome da empresa (1 linha)
2. Resultado concreto que você gerou pra loja parecida — foque em VENDAS e LEADS com ANÚNCIOS PAGOS (1-2 linhas)
3. Link de prova social: https://www.instagram.com/p/DW1a5bZB6I0/

REGRAS ABSOLUTAS:
- Máximo 280 caracteres (contando o link)
- SEMPRE termine com o link: https://www.instagram.com/p/DW1a5bZB6I0/
- Antes do link: "vê esse resultado:" ou "olha isso:" ou "dá play:"
- Falar APENAS de: anúncios pagos, leads, vendas, Meta Ads, Google Ads
- PROIBIDO MENCIONAR: rating, Google, avaliações, reviews, SEO, orgânico, buscas locais, redes sociais, captação digital, site, presença online
- Tom: direto e confiante, como dono de loja falando com outro dono
- Max 1 emoji (🚗 ou 📈)
- ACENTUAÇÃO CORRETA
- NUNCA: "tudo bem?", "podemos conversar?", "somos especialistas"

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
    // busca telefones que JÁ receberam mensagem (qualquer campanha, qualquer status)
    const { data: jaEnviados } = await supabase.from("disparo_mensagens")
      .select("telefone_destino")
      .eq("tenant_id", m.tenant_id);
    const telefonesJaEnviados = new Set((jaEnviados || []).map((d) => d.telefone_destino?.replace(/\D/g, "")));

    // busca TODOS os leads da lista
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
    let duplicados = 0;
    for (const lead of (leads || [])) {
      const tel = lead.whatsapp || lead.telefone;
      if (!tel) continue;

      // pula se já enviamos pra esse número antes
      const telLimpo = tel.replace(/\D/g, "");
      if (telefonesJaEnviados.has(telLimpo)) {
        duplicados++;
        continue;
      }
      telefonesJaEnviados.add(telLimpo); // marca pra não duplicar dentro da mesma campanha

      // gera copy personalizado com IA
      let texto = mensagem_padrao || "";
      try {
        texto = await aiChat({
          systemPrompt: prompt_template || PROMPT_COPY,
          messages: [{ role: "user", content: `Empresa: ${lead.nome}\nSegmento: ${lead.segmento || "loja de veículos"}` }],
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
        duplicados_pulados: duplicados,
      },
    });
  }

  return NextResponse.json({ campanha, total_mensagens: 0, debug: { leads_na_lista: 0 } });
}
