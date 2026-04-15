import { createClient } from "@/lib/supabase/server";

export interface AccessContext {
  userId: string | null;
  tenantId: string | null;
  isMaster: boolean;
  activeProducts: string[];
}

/** Pega o contexto de acesso do usuario logado (produtos ativos + flag master). */
export async function getAccessContext(): Promise<AccessContext> {
  const empty: AccessContext = { userId: null, tenantId: null, isMaster: false, activeProducts: [] };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: m } = await supabase.from("memberships")
    .select("tenant_id,tenant:tenants(id,is_master)")
    .eq("user_id", user.id).maybeSingle();
  if (!m) return { ...empty, userId: user.id };

  const tenant = m.tenant as { id?: string; is_master?: boolean } | null;
  const isMaster = !!tenant?.is_master;

  const { data: tps } = await supabase.from("tenant_products")
    .select("product_key").eq("tenant_id", m.tenant_id).eq("is_active", true);

  return {
    userId: user.id,
    tenantId: m.tenant_id,
    isMaster,
    activeProducts: (tps || []).map((t) => t.product_key),
  };
}
