import { createClient } from "@/lib/supabase/server";
import { NovoContratoWizard } from "@/components/contratos/novo-contrato-wizard";
import { CONTRATO_TEMPLATES } from "@/lib/contratos/templates";

export const dynamic = "force-dynamic";

export default async function NovoContratoPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase.from("clientes").select("id,nome,vertical,contato_email,contato_whatsapp").order("nome");

  const templatesPublicos = CONTRATO_TEMPLATES.map((t) => ({
    key: t.key, name: t.name, vertical: t.vertical, variables: t.variables,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Novo contrato</h1>
        <p className="text-muted-foreground">Escolha um template pronto, preencha os dados e envie pra assinatura digital.</p>
      </div>
      <NovoContratoWizard clientes={clientes || []} templates={templatesPublicos} />
    </div>
  );
}
