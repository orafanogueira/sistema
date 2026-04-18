import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DisparoUI } from "@/components/disparo/disparo-ui";

export const dynamic = "force-dynamic";

export default async function DisparoPage() {
  const supabase = await createClient();

  const { data: numeros } = await supabase.from("whatsapp_numeros").select("*").order("created_at");
  const { data: campanhas } = await supabase.from("disparo_campanhas").select("*").order("created_at", { ascending: false });
  const { data: listas } = await supabase.from("prospeccao_listas").select("id,name").order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-green-400" /> Disparo WhatsApp
        </h1>
        <p className="text-muted-foreground">Multi-número com rotação + mensagem personalizada por IA.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Phone className="h-3 w-3" /> Números ativos</div>
          <div className="text-3xl font-black mt-1">{(numeros || []).filter((n) => n.is_active).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Zap className="h-3 w-3" /> Campanhas</div>
          <div className="text-3xl font-black mt-1 text-cyan">{(campanhas || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><MessageCircle className="h-3 w-3" /> Total enviadas</div>
          <div className="text-3xl font-black mt-1 text-green-400">{(campanhas || []).reduce((s, c) => s + (c.total_enviadas || 0), 0)}</div>
        </CardContent></Card>
      </div>

      <DisparoUI
        numeros={numeros || []}
        campanhas={campanhas || []}
        listas={(listas || []) as Array<{ id: string; name: string }>}
      />
    </div>
  );
}
