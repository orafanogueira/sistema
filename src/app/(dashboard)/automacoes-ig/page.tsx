import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Zap, MessageCircle, Instagram, Sparkles } from "lucide-react";
import { NovaAutomacaoIgButton } from "@/components/automacoes-ig/nova-automacao-button";
import { ConnectIgButton } from "@/components/automacoes-ig/connect-ig-button";

export const dynamic = "force-dynamic";

export default async function AutomacoesIGPage() {
  const supabase = await createClient();
  const [{ data: automacoes }, { data: contas }, { data: clientes }] = await Promise.all([
    supabase.from("ig_automacoes")
      .select("*,cliente:clientes(nome),ig_account:instagram_accounts(ig_username)")
      .order("created_at", { ascending: false }),
    supabase.from("instagram_accounts").select("*,cliente:clientes(nome)").order("created_at"),
    supabase.from("clientes").select("id,nome").order("nome"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Automacoes Instagram</h1>
          <p className="text-muted-foreground">Palavras-chave em comentarios &rarr; DM automatica (estilo ManyChat).</p>
        </div>
        <div className="flex gap-2">
          <ConnectIgButton clientes={clientes || []} />
          <NovaAutomacaoIgButton clientes={clientes || []} contas={contas || []} />
        </div>
      </div>

      <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
        <CardContent className="p-5 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-cyan flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold mb-1">Como funciona</div>
            <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Conecta a conta Instagram Business do cliente</li>
              <li>Cria uma automacao com <b>palavras-chave</b> (ex: "quero", "info", "link")</li>
              <li>Define o <b>texto da DM</b> que sera enviado</li>
              <li>Quando alguem comenta a palavra-chave em um post, <b>recebe DM automatica</b></li>
              <li>O lead e criado no CRM com a origem: post especifico + username</li>
              <li>Opcional: IA assume o atendimento apos a primeira mensagem</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Total</div><div className="text-2xl font-black mt-1">{automacoes?.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Ativas</div><div className="text-2xl font-black mt-1 text-green-400">{(automacoes || []).filter((a) => a.is_active).length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Contas IG</div><div className="text-2xl font-black mt-1 text-cyan">{contas?.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Execucoes totais</div><div className="text-2xl font-black mt-1">{(automacoes || []).reduce((s, a) => s + (a.runs_count || 0), 0)}</div></CardContent></Card>
      </div>

      {contas?.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Instagram className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold mb-1">Conecte primeiro uma conta Instagram</div>
          <div className="text-sm text-muted-foreground mb-4">Voce precisa de uma conta Instagram Business + Page Facebook + Meta App aprovado.</div>
        </CardContent></Card>
      ) : !automacoes?.length ? (
        <Card><CardContent className="p-12 text-center">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold mb-1">Nenhuma automacao criada</div>
          <div className="text-sm text-muted-foreground mb-4">Crie palavras-chave que disparam DMs automaticamente.</div>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {automacoes.map((a) => {
            const cliente = a.cliente as { nome?: string } | null;
            const igAcc = a.ig_account as { ig_username?: string } | null;
            return (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={a.is_active ? "success" : "secondary"}>{a.is_active ? "ativa" : "pausada"}</Badge>
                        <h3 className="font-bold">{a.name}</h3>
                        {igAcc?.ig_username && <span className="text-xs text-muted-foreground">@{igAcc.ig_username}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        <span><Zap className="h-3 w-3 inline" /> {a.trigger.replace(/_/g, " ")}</span>
                        <span>🔑 keywords: {(a.keywords as string[])?.slice(0, 5).join(", ")}{a.keywords?.length > 5 ? `... (+${a.keywords.length - 5})` : ""}</span>
                        <span>Cliente: {cliente?.nome || "-"}</span>
                        <span>Execucoes: {a.runs_count || 0}</span>
                      </div>
                      {a.response_text && (
                        <div className="text-xs mt-2 p-2 bg-secondary rounded max-w-xl">
                          <MessageCircle className="h-3 w-3 inline mr-1 text-cyan" />
                          {a.response_text.slice(0, 160)}{a.response_text.length > 160 && "..."}
                        </div>
                      )}
                    </div>
                    <Link href={`/automacoes-ig/${a.id}`}><Button variant="outline" size="sm">Ver detalhes</Button></Link>
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
