import { Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LigacoesUI } from "@/components/ligacoes/ligacoes-ui";
import { VapiNumerosUI } from "@/components/ligacoes/vapi-numeros-ui";

export const dynamic = "force-dynamic";

export default async function LigacoesPage() {
  const supabase = await createClient();
  const { data: ligacoes } = await supabase.from("ligacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: filas } = await supabase.from("ligacoes_filas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Phone className="h-7 w-7 text-purple-400" /> Ligações IA
        </h1>
        <p className="text-muted-foreground">
          IA (Vapi.ai) liga sozinha pros leads, qualifica, agenda consultoria e registra tudo no CRM.
          Também tem fluxo manual pra humano fazer as ligações.
        </p>
      </div>

      <VapiNumerosUI />

      <LigacoesUI
        ligacoes={ligacoes || []}
        filas={filas || []}
      />
    </div>
  );
}
