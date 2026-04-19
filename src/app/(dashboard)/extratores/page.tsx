import { Search } from "lucide-react";
import { ExtratoresUI } from "@/components/extratores/extratores-ui";

export const dynamic = "force-dynamic";

export default function ExtratoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Search className="h-7 w-7 text-cyan" /> Extratores de Dados
        </h1>
        <p className="text-muted-foreground">Extraia seguidores do Instagram, membros de grupos Facebook e WhatsApp.</p>
      </div>
      <ExtratoresUI />
    </div>
  );
}
