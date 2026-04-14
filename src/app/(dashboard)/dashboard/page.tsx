import { DashboardCEO } from "@/components/dashboard-ceo/dashboard-ceo";
import { ImportClientesButton } from "@/components/clientes/import-clientes-button";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <ImportClientesButton />
      </div>
      <DashboardCEO />
    </div>
  );
}
