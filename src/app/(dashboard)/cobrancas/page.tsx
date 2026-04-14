import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Send } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/utils";
import { NovaCobrancaButton } from "@/components/financeiro/nova-cobranca-button";
import { EnviarWhatsAppButton } from "@/components/financeiro/enviar-wa-button";

export const dynamic = "force-dynamic";

export default async function CobrancasPage() {
  const supabase = await createClient();
  const [{ data: cobrancas }, { data: clientes }] = await Promise.all([
    supabase.from("cobrancas").select("*,cliente:clientes(nome,contato_whatsapp)").order("due_date", { ascending: false }),
    supabase.from("clientes").select("id,nome,contato_email,contato_whatsapp").order("nome"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Cobrancas</h1>
          <p className="text-muted-foreground">PIX, boleto e cartao via Asaas. Envio automatico por WhatsApp.</p>
        </div>
        <NovaCobrancaButton clientes={clientes || []} />
      </div>

      <Card>
        <CardContent className="p-0">
          {!cobrancas?.length ? (
            <div className="p-16 text-center text-muted-foreground">
              Nenhuma cobranca. Clica em "Nova cobranca" pra comecar.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Descricao</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-left">Forma</th>
                  <th className="p-3 text-left">Vencimento</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => {
                  const cliente = c.cliente as { nome?: string; contato_whatsapp?: string } | null;
                  return (
                    <tr key={c.id} className="border-b border-border hover:bg-secondary/40">
                      <td className="p-3">{c.descricao || "-"}</td>
                      <td className="p-3 text-muted-foreground">{cliente?.nome}</td>
                      <td className="p-3 text-right font-mono">{formatBRL(Number(c.valor))}</td>
                      <td className="p-3 text-xs">{c.forma_pagamento}</td>
                      <td className="p-3 text-xs">{formatDate(c.due_date)}</td>
                      <td className="p-3">
                        <Badge variant={c.status === "paga" ? "success" : c.status === "vencida" ? "destructive" : "warning"}>{c.status}</Badge>
                      </td>
                      <td className="p-3 text-right flex gap-1">
                        {cliente?.contato_whatsapp && c.status === "pendente" && <EnviarWhatsAppButton cobrancaId={c.id} />}
                        {c.asaas_invoice_url && <a href={c.asaas_invoice_url} target="_blank"><Button size="sm" variant="ghost">Abrir fatura</Button></a>}
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
