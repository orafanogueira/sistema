import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Zap } from "lucide-react";
import { DisparoEmailUI } from "@/components/disparo/disparo-email-ui";

export const dynamic = "force-dynamic";

export default async function DisparoEmailPage() {
  const supabase = await createClient();
  const { data: campanhas } = await supabase.from("email_campanhas").select("*").order("created_at", { ascending: false });
  const { data: listas } = await supabase.from("prospeccao_listas").select("id,name").order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Mail className="h-7 w-7 text-cyan" /> Disparo Email
        </h1>
        <p className="text-muted-foreground">Sequências de email com copy personalizado por IA.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Campanhas</div>
          <div className="text-3xl font-black mt-1">{(campanhas || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Total enviados</div>
          <div className="text-3xl font-black mt-1 text-cyan">{(campanhas || []).reduce((s, c) => s + (c.total_enviados || 0), 0)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Total erros</div>
          <div className="text-3xl font-black mt-1 text-red-400">{(campanhas || []).reduce((s, c) => s + (c.total_erros || 0), 0)}</div>
        </CardContent></Card>
      </div>

      <DisparoEmailUI
        campanhas={campanhas || []}
        listas={(listas || []) as Array<{ id: string; name: string }>}
      />
    </div>
  );
}
