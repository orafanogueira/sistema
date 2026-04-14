import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [{ data: assinaturas }, { data: cobrancas }] = await Promise.all([
    supabase.from("assinaturas").select("*,cliente:clientes(nome)").eq("tenant_id", m.tenant_id).eq("active", true),
    supabase.from("cobrancas").select("*,cliente:clientes(nome)").eq("tenant_id", m.tenant_id).order("due_date", { ascending: false }),
  ]);

  const mrr = (assinaturas || []).reduce((s, a) => s + Number(a.mrr_amount || 0), 0);
  const arr = mrr * 12;
  const receitaRecebida30d = (cobrancas || [])
    .filter((c) => c.status === "paga" && c.paid_at && c.paid_at >= thirtyDaysAgo)
    .reduce((s, c) => s + Number(c.valor), 0);
  const previsao30d = (cobrancas || [])
    .filter((c) => c.status === "pendente" && c.due_date >= today && c.due_date <= thirtyDaysAhead)
    .reduce((s, c) => s + Number(c.valor), 0);
  const inadimplencia = (cobrancas || [])
    .filter((c) => (c.status === "pendente" || c.status === "vencida") && c.due_date < today)
    .reduce((s, c) => s + Number(c.valor), 0);

  // Top clientes por MRR
  const porCliente: Record<string, { nome: string; mrr: number; cliente_id: string }> = {};
  for (const a of assinaturas || []) {
    const cliente = a.cliente as { nome?: string } | null;
    const nm = cliente?.nome || "-";
    if (!porCliente[a.cliente_id]) porCliente[a.cliente_id] = { nome: nm, mrr: 0, cliente_id: a.cliente_id };
    porCliente[a.cliente_id].mrr += Number(a.mrr_amount || 0);
  }
  const topClientes = Object.values(porCliente).sort((a, b) => b.mrr - a.mrr).slice(0, 10);

  // Cobrancas vencidas (inadimplentes por cliente)
  const inadimplentes: Record<string, { nome: string; cliente_id: string; total: number; qtd: number }> = {};
  for (const c of cobrancas || []) {
    if ((c.status === "pendente" || c.status === "vencida") && c.due_date < today) {
      const cliente = c.cliente as { nome?: string } | null;
      if (!inadimplentes[c.cliente_id]) inadimplentes[c.cliente_id] = { nome: cliente?.nome || "-", cliente_id: c.cliente_id, total: 0, qtd: 0 };
      inadimplentes[c.cliente_id].total += Number(c.valor);
      inadimplentes[c.cliente_id].qtd++;
    }
  }

  // Ultimas cobrancas
  const ultimasCobrancas = (cobrancas || []).slice(0, 20);

  return NextResponse.json({
    kpis: {
      mrr, arr,
      receita_30d: receitaRecebida30d,
      previsao_30d: previsao30d,
      inadimplencia,
      total_cobrancas: (cobrancas || []).length,
      pagas_30d: (cobrancas || []).filter((c) => c.status === "paga" && c.paid_at && c.paid_at >= thirtyDaysAgo).length,
      pendentes: (cobrancas || []).filter((c) => c.status === "pendente").length,
      vencidas: (cobrancas || []).filter((c) => c.status === "vencida" || (c.status === "pendente" && c.due_date < today)).length,
      assinaturas_ativas: (assinaturas || []).length,
    },
    top_clientes: topClientes,
    inadimplentes: Object.values(inadimplentes).sort((a, b) => b.total - a.total),
    ultimas_cobrancas: ultimasCobrancas,
  });
}
