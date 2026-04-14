import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail } from "lucide-react";

export default async function VendedoresPage() {
  const supabase = await createClient();
  const { data: vendedores } = await supabase
    .from("vendedores").select("*,cliente:clientes(nome)")
    .order("nome");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Vendedores</h1>
          <p className="text-muted-foreground">Equipe de atendimento que recebe leads via round-robin.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Adicionar vendedor</Button>
      </div>

      {(vendedores || []).length === 0 ? (
        <Card><CardContent className="p-16 text-center text-muted-foreground">
          Nenhum vendedor cadastrado. Adicione vendedores para distribuir leads automaticamente.
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {(vendedores || []).map((v) => {
            const cliente = v.cliente as { nome?: string } | null;
            return (
              <Card key={v.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold">{v.nome}</div>
                      <div className="text-xs text-muted-foreground">{cliente?.nome || "-"}</div>
                    </div>
                    <Badge variant={v.is_active ? "success" : "secondary"}>{v.is_active ? "ativo" : "inativo"}</Badge>
                  </div>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    {v.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{v.email}</div>}
                    {v.whatsapp && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.whatsapp}</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
