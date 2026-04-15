/**
 * Tools do copiloto IA - funcoes que o Claude pode invocar
 * pra executar acoes no sistema.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MetaAdsClient, extractAction } from "@/lib/integrations/meta-ads";

export const COPILOT_TOOLS: Anthropic.Tool[] = [
  {
    name: "listar_clientes",
    description: "Lista todos os clientes do tenant, com filtros opcionais.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "ativo, pausado, encerrado, prospect" },
        vertical: { type: "string", description: "agencia, automotivo, comercial" },
      },
    },
  },
  {
    name: "buscar_cliente",
    description: "Busca um cliente pelo nome (fuzzy match).",
    input_schema: {
      type: "object",
      properties: { nome: { type: "string" } },
      required: ["nome"],
    },
  },
  {
    name: "analisar_campanhas_meta",
    description: "Analisa campanhas Meta Ads de um cliente nos ultimos N dias. Retorna metricas agregadas.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        dias: { type: "number", description: "Periodo em dias. Default 30." },
      },
      required: ["cliente_id"],
    },
  },
  {
    name: "contar_leads",
    description: "Conta leads de um cliente por periodo e status.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        dias: { type: "number" },
        status: { type: "string", description: "novo, em_atendimento, qualificado, ganho, perdido..." },
      },
      required: ["cliente_id"],
    },
  },
  {
    name: "criar_cobranca",
    description: "Cria cobranca no Asaas (PIX/boleto) pra um cliente.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        descricao: { type: "string" },
        valor: { type: "number", description: "Valor em reais. Minimo R$ 5,00." },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        forma_pagamento: { type: "string", description: "pix, boleto, credit_card, undefined" },
      },
      required: ["cliente_id", "descricao", "valor", "due_date"],
    },
  },
  {
    name: "resumo_financeiro",
    description: "Retorna KPIs financeiros do tenant: MRR, receita 30d, inadimplencia, previsao.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "listar_alertas",
    description: "Lista alertas ativos (nao resolvidos) do tenant.",
    input_schema: {
      type: "object",
      properties: {
        severity: { type: "string", description: "critical, warning, info" },
        cliente_id: { type: "string" },
      },
    },
  },
  {
    name: "sugerir_otimizacao_campanhas",
    description: "Analisa campanhas ativas e sugere acoes: pausar, escalar, duplicar, trocar criativo.",
    input_schema: {
      type: "object",
      properties: { cliente_id: { type: "string" } },
      required: ["cliente_id"],
    },
  },
  {
    name: "gerar_link_dashboard_publico",
    description: "Gera link publico pra cliente acessar dashboard dele sem login.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        name: { type: "string", description: "Nome do link" },
        expires_days: { type: "number", description: "Dias ate expirar (default 90)" },
      },
      required: ["cliente_id"],
    },
  },
];

// ============================================================
// Execucoes
// ============================================================
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { supabase: SupabaseClient; tenant_id: string; user_id: string }
): Promise<unknown> {
  const { supabase, tenant_id } = ctx;

  switch (name) {
    case "listar_clientes": {
      let q = supabase.from("clientes").select("id,nome,vertical,status,ticket_mensal").eq("tenant_id", tenant_id).limit(50);
      if (input.status) q = q.eq("status", input.status as string);
      if (input.vertical) q = q.eq("vertical", input.vertical as string);
      const { data } = await q;
      return { count: data?.length || 0, clientes: data || [] };
    }

    case "buscar_cliente": {
      const { data } = await supabase.from("clientes")
        .select("id,nome,vertical,status,ticket_mensal,contato_email,contato_whatsapp")
        .eq("tenant_id", tenant_id).ilike("nome", `%${input.nome}%`).limit(5);
      return { matches: data || [] };
    }

    case "analisar_campanhas_meta": {
      const { data: integ } = await supabase.from("integrations")
        .select("access_token,account_id")
        .eq("cliente_id", input.cliente_id as string).eq("provider", "meta_ads").eq("is_connected", true).maybeSingle();
      if (!integ) return { error: "Meta Ads nao conectado pra esse cliente" };

      const token = integ.access_token || process.env.META_ACCESS_TOKEN;
      if (!token) return { error: "Token Meta ausente" };
      const dias = Number(input.dias || 30);
      const since = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
      const until = new Date().toISOString().slice(0, 10);
      try {
        const client = new MetaAdsClient(token, integ.account_id!);
        const rows = await client.insights({ since, until, level: "campaign" });
        const analise = rows.map((r) => ({
          campanha: r.campaign_name, spend: Number(r.spend || 0), clicks: Number(r.clicks || 0),
          ctr: Number(r.ctr || 0), cpc: Number(r.cpc || 0),
          leads: extractAction(r, "complete_registration") || extractAction(r, "offsite_conversion.fb_pixel_custom"),
        }));
        const total = {
          spend: analise.reduce((s, c) => s + c.spend, 0),
          clicks: analise.reduce((s, c) => s + c.clicks, 0),
          leads: analise.reduce((s, c) => s + c.leads, 0),
        };
        return { periodo_dias: dias, total, campanhas: analise };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "erro API Meta" };
      }
    }

    case "contar_leads": {
      const dias = Number(input.dias || 30);
      const since = new Date(Date.now() - dias * 86400000).toISOString();
      let q = supabase.from("leads").select("*", { count: "exact", head: true })
        .eq("cliente_id", input.cliente_id as string).gte("created_at", since);
      if (input.status) q = q.eq("status", input.status as string);
      const { count } = await q;
      return { count: count || 0, periodo_dias: dias, status: input.status || "todos" };
    }

    case "criar_cobranca": {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cobrancas`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: "" },
          body: JSON.stringify({
            cliente_id: input.cliente_id,
            descricao: input.descricao,
            valor: input.valor,
            due_date: input.due_date,
            forma_pagamento: input.forma_pagamento || "pix",
          }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { cobranca_id: data.id, status: "criada", asaas_invoice_url: data.asaas_invoice_url };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "erro" };
      }
    }

    case "resumo_financeiro": {
      const now = new Date();
      const [{ data: assinaturas }, { data: cobrancas }] = await Promise.all([
        supabase.from("assinaturas").select("mrr_amount").eq("tenant_id", tenant_id).eq("active", true),
        supabase.from("cobrancas").select("valor,status,paid_at,due_date").eq("tenant_id", tenant_id),
      ]);
      const mrr = (assinaturas || []).reduce((s, a) => s + Number(a.mrr_amount || 0), 0);
      const thirtyAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const receita30d = (cobrancas || []).filter((c) => c.status === "paga" && c.paid_at && c.paid_at >= thirtyAgo).reduce((s, c) => s + Number(c.valor), 0);
      const inad = (cobrancas || []).filter((c) => (c.status === "pendente" || c.status === "vencida") && c.due_date < today).reduce((s, c) => s + Number(c.valor), 0);
      return { mrr, arr: mrr * 12, receita_30d: receita30d, inadimplencia: inad };
    }

    case "listar_alertas": {
      let q = supabase.from("alerts").select("*,cliente:clientes(nome)")
        .eq("tenant_id", tenant_id).eq("is_resolved", false).order("severity", { ascending: false }).limit(20);
      if (input.severity) q = q.eq("severity", input.severity as string);
      if (input.cliente_id) q = q.eq("cliente_id", input.cliente_id as string);
      const { data } = await q;
      return { count: data?.length || 0, alertas: data || [] };
    }

    case "sugerir_otimizacao_campanhas": {
      // Chama analise de campanhas e gera sugestoes textuais
      const analise = await executeTool("analisar_campanhas_meta", { cliente_id: input.cliente_id, dias: 7 }, ctx) as { campanhas?: { campanha: string; spend: number; leads: number; ctr: number; cpc: number }[] };
      if (!analise.campanhas) return { error: "nao foi possivel analisar campanhas" };
      const sugestoes: string[] = [];
      for (const c of analise.campanhas) {
        if (c.spend > 0 && c.leads === 0) sugestoes.push(`⏸️ Pausar "${c.campanha}" — R$ ${c.spend.toFixed(2)} sem leads`);
        if (c.ctr > 2 && c.leads > 0) sugestoes.push(`📈 Escalar "${c.campanha}" — CTR ${c.ctr.toFixed(2)}% e ${c.leads} leads`);
        if (c.ctr < 0.5 && c.spend > 50) sugestoes.push(`🎨 Trocar criativo de "${c.campanha}" — CTR baixo ${c.ctr.toFixed(2)}%`);
      }
      return { sugestoes, resumo: analise };
    }

    case "gerar_link_dashboard_publico": {
      const expires = input.expires_days ? new Date(Date.now() + Number(input.expires_days) * 86400000).toISOString() : null;
      const { data, error } = await supabase.from("dashboard_public_links").insert({
        tenant_id, cliente_id: input.cliente_id as string, name: (input.name as string) || "Dashboard cliente",
        expires_at: expires, created_by: ctx.user_id,
      }).select().single();
      if (error) return { error: error.message };
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard-publico/${data.token}`;
      return { link: url, expires_at: expires };
    }

    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}
