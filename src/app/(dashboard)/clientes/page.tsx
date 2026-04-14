import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/utils";
import { Plus, Users } from "lucide-react";
import { NovoClienteButton } from "@/components/clientes/novo-cliente-dialog";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id,slug,nome,segmento,status,ticket_mensal,vencimento,data_inicio,contato_whatsapp,contato_email")
    .order("nome");

  const statusColor: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    ativo: "success", pausado: "warning", encerrado: "destructive", prospect: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">{(clientes || []).length} cliente(s) cadastrado(s)</p>
        </div>
        <NovoClienteButton />
      </div>

      {(clientes || []).length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="font-bold text-lg mb-1">Nenhum cliente cadastrado</div>
            <div className="text-sm text-muted-foreground mb-6">Cadastre seu primeiro cliente pra comecar a operar.</div>
            <NovoClienteButton />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-left text-[11px] uppercase text-muted-foreground tracking-wider">
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Segmento</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Ticket</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4">Inicio</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {(clientes || []).map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-secondary/40">
                    <td className="p-4">
                      <Link href={`/clientes/${c.id}`} className="font-semibold hover:text-cyan">{c.nome}</Link>
                      <div className="text-[11px] text-muted-foreground">{c.contato_email || c.contato_whatsapp || "-"}</div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{c.segmento || "-"}</td>
                    <td className="p-4"><Badge variant={statusColor[c.status] || "secondary"}>{c.status}</Badge></td>
                    <td className="p-4 font-mono text-sm">{formatBRL(Number(c.ticket_mensal || 0))}</td>
                    <td className="p-4 text-sm">Dia {c.vencimento || "-"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{formatDate(c.data_inicio)}</td>
                    <td className="p-4"><Link href={`/clientes/${c.id}`}><Button variant="ghost" size="sm">Abrir</Button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
