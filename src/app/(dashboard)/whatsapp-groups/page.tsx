import { MessageSquare } from "lucide-react";
import { WhatsAppGroupsUI } from "@/components/whatsapp-groups/whatsapp-groups-ui";

export const dynamic = "force-dynamic";

export default function WhatsAppGroupsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-green-500" /> WhatsApp Groups
        </h1>
        <p className="text-muted-foreground">
          Busca grupos por nicho, entra em 1 clique, extrai contatos via Z-API e dispara mensagens com IA.
        </p>
      </div>

      <WhatsAppGroupsUI />
    </div>
  );
}
