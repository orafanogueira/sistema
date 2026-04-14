import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, CheckCircle2 } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  rascunho: "secondary", gerando_ia: "secondary", pronto: "warning",
  enviado_assinatura: "warning", assinado: "success",
  cancelado: "destructive", rejeitado: "destructive",
};

export default async function ContratosPage() {
  const supabase = await createClient();
  const { data: contratos } = await supabase
    .from("contratos")
    .select("*,cliente:clientes(nome),signatarios:contrato_signatarios(signed_at)")
    .order("created_at", { ascending: false });

  const stats = {
    total: contratos?.length || 0,
    pendentes: (contratos || []).filter((c) => c.status === "enviado_assinatura").length,
    assinados: (contratos || []).filter((c) => c.status === "assinado").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Contratos</h1>
          <p className="text-muted-foreground">Geracao automatica por IA + assinatura digital via Clicksign.</p>
        </div>
        <Link href="/contratos/novo"><Button><Plus className="h-4 w-4" /> Novo contrato</Button></Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Total</div><div className="text-2xl font-black mt-1">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Aguardando assinatura</div><div className="text-2xl font-black mt-1 text-yellow-400">{stats.pendentes}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Assinados</div><div className="text-2xl font-black mt-1 text-green-400">{stats.assinados}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Contratos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!contratos?.length ? (
            <div className="p-16 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="font-bold mb-2">Nenhum contrato ainda</div>
              <Link href="/contratos/novo"><Button>Criar primeiro contrato</Button></Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Titulo</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Valor</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Signatarios</th>
                  <th className="p-3 text-left">Criado</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => {
                  const cliente = c.cliente as { nome?: string } | null;
                  const sigs = (c.signatarios as { signed_at: string | null }[]) || [];
                  const assinados = sigs.filter((s) => s.signed_at).length;
                  return (
                    <tr key={c.id} className="border-b border-border hover:bg-secondary/40">
                      <td className="p-3">
                        <Link href={`/contratos/${c.id}`} className="font-semibold hover:text-cyan">{c.titulo}</Link>
                      </td>
                      <td className="p-3 text-muted-foreground">{cliente?.nome || "-"}</td>
                      <td className="p-3 font-mono text-xs">{c.valor ? formatBRL(Number(c.valor)) : "-"}</td>
                      <td className="p-3"><Badge variant={STATUS_COLORS[c.status] || "secondary"}>{c.status.replace(/_/g, " ")}</Badge></td>
                      <td className="p-3 text-xs">{assinados}/{sigs.length} {assinados === sigs.length && sigs.length > 0 && <CheckCircle2 className="h-3 w-3 inline text-green-400 ml-1" />}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                      <td className="p-3">
                        <Link href={`/contratos/${c.id}`}><Button variant="ghost" size="sm">Abrir</Button></Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
