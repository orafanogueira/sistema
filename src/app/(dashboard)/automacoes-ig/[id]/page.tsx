import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AutomacaoIgDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auto } = await supabase.from("ig_automacoes")
    .select("*,cliente:clientes(nome),ig_account:instagram_accounts(ig_username,ig_user_id)")
    .eq("id", id).maybeSingle();
  if (!auto) notFound();

  const { data: runs } = await supabase.from("ig_automacao_runs")
    .select("*").eq("automacao_id", id).order("created_at", { ascending: false }).limit(100);

  const cliente = auto.cliente as { nome?: string } | null;
  const igAcc = auto.ig_account as { ig_username?: string } | null;
  const keywords = (auto.keywords as string[]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/automacoes-ig"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black">{auto.name}</h1>
            <Badge variant={auto.is_active ? "success" : "secondary"}>{auto.is_active ? "ativa" : "pausada"}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Cliente: {cliente?.nome} · @{igAcc?.ig_username}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Execucoes totais</div><div className="text-2xl font-bold mt-1">{auto.runs_count || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">DMs enviadas</div><div className="text-2xl font-bold mt-1 text-green-400">{(runs || []).filter((r) => r.action_taken === "sent_dm").length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Falhas</div><div className="text-2xl font-bold mt-1 text-red-400">{(runs || []).filter((r) => r.status === "failed").length}</div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Configuracao</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-[11px] uppercase text-muted-foreground mb-1">Keywords</div>
              <div className="flex flex-wrap gap-1">
                {keywords.map((k) => <Badge key={k} variant="outline">{k}</Badge>)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-muted-foreground mb-1">Resposta DM</div>
              <div className="p-3 bg-secondary rounded text-sm whitespace-pre-wrap">{auto.response_text || "-"}</div>
            </div>
            {auto.send_public_reply && auto.public_reply_text && (
              <div>
                <div className="text-[11px] uppercase text-muted-foreground mb-1">Resposta publica</div>
                <div className="p-3 bg-secondary rounded text-sm">{auto.public_reply_text}</div>
              </div>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Match mode: {auto.keyword_match_mode}</div>
              <div>1 por usuario: {auto.one_per_user ? "sim" : "nao"}</div>
              <div>Criar lead: {auto.create_lead ? "sim" : "nao"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Historico de execucoes</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {!runs?.length ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma execucao ainda.</div>
            ) : runs.map((r) => (
              <div key={r.id} className="p-2 bg-secondary/40 rounded text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">@{r.ig_username || r.ig_user_id}</div>
                  <Badge variant={r.status === "success" ? "success" : r.status === "failed" ? "destructive" : "secondary"} className="text-[9px]">{r.action_taken}</Badge>
                </div>
                {r.comment_text && <div className="text-muted-foreground mt-1 italic">&quot;{r.comment_text}&quot;</div>}
                {r.matched_keyword && <div className="text-cyan mt-1">Match: <b>{r.matched_keyword}</b></div>}
                {r.error && <div className="text-red-400 mt-1">{r.error}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{formatDate(r.created_at)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
