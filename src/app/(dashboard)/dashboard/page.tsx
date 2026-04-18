import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardCEO } from "@/components/dashboard-ceo/dashboard-ceo";
import { ImportClientesButton } from "@/components/clientes/import-clientes-button";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Dashboard CEO só pra owner do tenant
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("memberships")
    .select("role,can_see_financeiro")
    .eq("user_id", user.id).maybeSingle();

  const role = membership?.role || "readonly";
  const canSeeFinanceiro = role === "owner" || !!(membership as Record<string, unknown>)?.can_see_financeiro;

  if (!canSeeFinanceiro) {
    // redireciona pra pagina principal do departamento do membro
    redirect("/social");
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-4">
        <OnboardingWizard />
        <ImportClientesButton />
      </div>
      <DashboardCEO />
    </div>
  );
}
