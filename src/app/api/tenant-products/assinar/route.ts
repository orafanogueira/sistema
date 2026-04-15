import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ativa um produto no tenant do usuario logado.
 * Cria Asaas subscription SE env configurada (senao so ativa local pra teste).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships")
    .select("tenant_id,tenant:tenants(id,is_master)")
    .eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { product_key, ciclo } = await req.json();
  if (!product_key) return new NextResponse("product_key obrigatorio", { status: 400 });

  const { data: product } = await supabase.from("products")
    .select("*").eq("key", product_key).maybeSingle();
  if (!product) return new NextResponse("produto nao existe", { status: 404 });

  // upsert tenant_products
  await supabase.from("tenant_products").upsert({
    tenant_id: m.tenant_id,
    product_key,
    is_active: true,
    started_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,product_key" });

  // TODO: criar Asaas subscription quando Asaas estiver pronto
  // Por enquanto retorna ativo local

  return NextResponse.json({
    ok: true,
    product_key,
    ciclo,
    valor: ciclo === "YEARLY" ? product.price_yearly : product.price_monthly,
  });
}
