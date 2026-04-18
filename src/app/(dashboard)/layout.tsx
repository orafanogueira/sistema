import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CopilotFab } from "@/components/copilot/copilot-fab";
import { Toaster } from "@/components/ui/toaster";
import { getAccessContext } from "@/lib/access/server";
import { hasAnyProduct, productsRequiredFor, isAdminOnlyRoute } from "@/lib/access/products";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();
  const { data: membership } = await supabase
    .from("memberships").select("role,can_see_financeiro,tenant:tenants(name,slug)")
    .eq("user_id", user.id).eq("is_active", true).maybeSingle();

  const tenantName = (membership?.tenant as { name?: string } | null)?.name || "Sem tenant";
  const userName = profile?.full_name || user.email?.split("@")[0] || "Usuario";
  const userRole = membership?.role || "readonly";

  // Access gating por produto
  const access = await getAccessContext();
  const h = await headers();
  const pathname = h.get("x-pathname") || h.get("x-invoke-path") || "";
  const required = productsRequiredFor(pathname);
  const allowed = hasAnyProduct(access.activeProducts, required, access.isMaster);
  if (!allowed) redirect("/planos");

  // Financeiro/dashboard: só owner OU quem tem can_see_financeiro habilitado
  const canSeeFinanceiro = userRole === "owner" || !!(membership as Record<string, unknown>)?.can_see_financeiro;
  if (isAdminOnlyRoute(pathname) && !canSeeFinanceiro) {
    redirect("/social");
  }

  return (
    <div className="min-h-screen">
      <Sidebar tenantName={tenantName} activeProducts={access.activeProducts} isMaster={access.isMaster} userRole={userRole} canSeeFinanceiro={canSeeFinanceiro} />
      <div className="pl-64">
        <Topbar userName={userName} />
        <main className="p-6">{children}</main>
      </div>
      <CopilotFab />
      <Toaster />
    </div>
  );
}
