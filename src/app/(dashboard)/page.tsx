import { DashboardCEO } from "@/components/dashboard-ceo/dashboard-ceo";
import { ImportClientesButton } from "@/components/clientes/import-clientes-button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { count } = await supabase.from("clientes").select("*", { count: "exact", head: true });

  return (
    <div className="space-y-6">
      {(count || 0) < 5 && (
        <div className="max-w-2xl">
          <ImportClientesButton totalAtual={count || 0} />
        </div>
      )}
      <DashboardCEO />
    </div>
  );
}
