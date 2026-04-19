import { Facebook } from "lucide-react";
import { FacebookGroupsUI } from "@/components/facebook-groups/facebook-groups-ui";

export const dynamic = "force-dynamic";

export default function FacebookGroupsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Facebook className="h-7 w-7 text-blue-500" /> Facebook Groups
        </h1>
        <p className="text-muted-foreground">
          Busca grupos por nicho, extrai autores ativos + comentadores e dispara WhatsApp/Email em 1 clique.
        </p>
      </div>

      <FacebookGroupsUI />
    </div>
  );
}
