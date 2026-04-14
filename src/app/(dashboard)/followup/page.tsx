import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Plus, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function FollowupPage() {
  const supabase = await createClient();
  const [{ data: templates }, { data: flows }, { data: runs }] = await Promise.all([
    supabase.from("followup_templates").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("followup_flows").select("*").order("created_at", { ascending: false }),
    supabase.from("followup_runs")
      .select("id,channel,recipient,status,scheduled_for,sent_at,cliente:clientes(nome)")
      .order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Follow-up</h1>
          <p className="text-muted-foreground">Automacoes de email e WhatsApp.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Plus className="h-4 w-4" /> Template</Button>
          <Button><Zap className="h-4 w-4" /> Novo fluxo</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Templates</div>
          <div className="text-3xl font-black mt-1">{(templates || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Fluxos ativos</div>
          <div className="text-3xl font-black mt-1 text-green-400">{(flows || []).filter((f) => f.is_active).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Envios (ultimos 30d)</div>
          <div className="text-3xl font-black mt-1 text-cyan">{(runs || []).length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Envios recentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(runs || []).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum envio ainda. Crie um template e um fluxo para comecar.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Canal</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Destino</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Agendado</th>
                  <th className="p-3 text-left">Enviado</th>
                </tr>
              </thead>
              <tbody>
                {(runs || []).map((r) => {
                  const cliente = r.cliente as { nome?: string } | null;
                  return (
                    <tr key={r.id} className="border-b border-border">
                      <td className="p-3">
                        {r.channel === "email" ? <Mail className="h-4 w-4 inline mr-1" /> : <MessageCircle className="h-4 w-4 inline mr-1" />}
                        {r.channel}
                      </td>
                      <td className="p-3">{cliente?.nome || "-"}</td>
                      <td className="p-3 font-mono text-xs">{r.recipient}</td>
                      <td className="p-3"><Badge variant={r.status === "sent" ? "success" : r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge></td>
                      <td className="p-3 text-xs">{formatDate(r.scheduled_for)}</td>
                      <td className="p-3 text-xs">{formatDate(r.sent_at)}</td>
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
