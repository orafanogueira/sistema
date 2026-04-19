import { Linkedin } from "lucide-react";
import { ApolloUI } from "@/components/apollo/apollo-ui";

export const dynamic = "force-dynamic";

export default function ApolloPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Linkedin className="h-7 w-7 text-[#0A66C2]" /> Apollo LinkedIn
        </h1>
        <p className="text-muted-foreground">
          Banco global de +275M de profissionais. Busca decisores por cargo, empresa e localização → extrai email/telefone → dispara em 1 clique.
        </p>
      </div>

      <ApolloUI />
    </div>
  );
}
