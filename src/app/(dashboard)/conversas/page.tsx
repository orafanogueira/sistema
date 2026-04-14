import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessagesSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ConversasPage() {
  const supabase = await createClient();
  const { data: conversas } = await supabase
    .from("conversas")
    .select("id,platform,contact_name,contact_identifier,last_message_at,unread_count,ai_enabled,cliente:clientes(nome)")
    .order("last_message_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Conversas</h1>
        <p className="text-muted-foreground">Mensagens unificadas de Messenger, Instagram, WhatsApp.</p>
      </div>

      {(conversas || []).length === 0 ? (
        <Card><CardContent className="p-16 text-center">
          <MessagesSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold text-lg mb-1">Nenhuma conversa ainda</div>
          <div className="text-sm text-muted-foreground">Conecte Meta (Messenger/IG/WhatsApp) e configure o webhook.</div>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr><th className="p-3 text-left">Plataforma</th><th className="p-3 text-left">Contato</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">IA</th><th className="p-3 text-left">Ultima msg</th><th className="p-3 text-left">Nao lidas</th></tr>
              </thead>
              <tbody>
                {(conversas || []).map((c) => {
                  const cliente = c.cliente as { nome?: string } | null;
                  return (
                    <tr key={c.id} className="border-b border-border">
                      <td className="p-3"><Badge variant="outline">{c.platform}</Badge></td>
                      <td className="p-3 font-semibold">{c.contact_name || c.contact_identifier}</td>
                      <td className="p-3 text-muted-foreground">{cliente?.nome || "-"}</td>
                      <td className="p-3">{c.ai_enabled ? <Badge variant="success">ativa</Badge> : <Badge variant="secondary">manual</Badge>}</td>
                      <td className="p-3 text-xs">{formatDate(c.last_message_at)}</td>
                      <td className="p-3">{c.unread_count > 0 ? <Badge variant="warning">{c.unread_count}</Badge> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
