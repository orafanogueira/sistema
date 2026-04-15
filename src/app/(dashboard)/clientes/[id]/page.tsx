import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/utils";
import { ArrowLeft, Mail, MessageCircle, Building2, Calendar } from "lucide-react";
import { ClienteDashboard } from "@/components/clientes/cliente-dashboard";
import { AcoesCliente } from "@/components/clientes/acoes-cliente";

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!cliente) notFound();

  const { data: integrations } = await supabase.from("integrations").select("*").eq("cliente_id", id);

  const statusColor: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    ativo: "success", pausado: "warning", encerrado: "destructive", prospect: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clientes"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">{cliente.nome}</h1>
            <Badge variant={statusColor[cliente.status] || "secondary"}>{cliente.status}</Badge>
          </div>
          <p className="text-muted-foreground">{cliente.segmento || "Sem segmento"}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">Ticket mensal</div>
          <div className="text-xl font-bold mt-1">{formatBRL(Number(cliente.ticket_mensal || 0))}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">Vencimento</div>
          <div className="text-xl font-bold mt-1">Dia {cliente.vencimento || "-"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">Inicio</div>
          <div className="text-xl font-bold mt-1">{formatDate(cliente.data_inicio)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">Integracoes</div>
          <div className="text-xl font-bold mt-1">{(integrations || []).length}</div>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> Contato</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Nome:</span> {cliente.contato_nome || "-"}</div>
            <div><span className="text-muted-foreground">Email:</span> {cliente.contato_email || "-"}</div>
            <div><span className="text-muted-foreground">WhatsApp:</span> {cliente.contato_whatsapp || "-"}</div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Observacoes</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {cliente.observacoes || "Sem observacoes."}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Acoes rapidas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start"><MessageCircle className="h-4 w-4" /> Mandar WhatsApp</Button>
            <Link href={`/integracoes?cliente=${id}`}><Button variant="outline" size="sm" className="w-full justify-start">Conectar integracoes</Button></Link>
            <div className="pt-2 border-t border-border space-y-2">
              <AcoesCliente clienteId={id} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard em tempo real (client component) */}
      <ClienteDashboard clienteId={id} integrations={integrations || []} />
    </div>
  );
}
