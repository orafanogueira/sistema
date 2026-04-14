import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Link2, Copy } from "lucide-react";
import { NovoLinkButton } from "@/components/rastreamento/novo-link-button";
import { CopyButton } from "@/components/rastreamento/copy-button";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("short_links")
    .select("*,cliente:clientes(nome)")
    .order("created_at", { ascending: false });
  const { data: clientes } = await supabase.from("clientes").select("id,nome").order("nome");

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://gruponogueiramkt.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Links Rastreaveis</h1>
          <p className="text-muted-foreground">Gere links curtos com rastreamento automatico (fbclid, gclid, UTMs).</p>
        </div>
        <NovoLinkButton clientes={clientes || []} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Todos os links</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!links?.length ? (
            <div className="p-16 text-center">
              <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="font-bold mb-1">Nenhum link ainda</div>
              <div className="text-sm text-muted-foreground">Crie o primeiro link curto rastreavel.</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">URL curta</th>
                  <th className="p-3 text-left">Destino</th>
                  <th className="p-3 text-right">Cliques</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const cliente = l.cliente as { nome?: string } | null;
                  const shortUrl = `${base}/api/t/${l.slug}`;
                  return (
                    <tr key={l.id} className="border-b border-border">
                      <td className="p-3 font-semibold">{l.name}</td>
                      <td className="p-3 text-muted-foreground">{cliente?.nome || "-"}</td>
                      <td className="p-3 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan">{shortUrl}</span>
                          <CopyButton text={shortUrl} />
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{l.destination_url}</td>
                      <td className="p-3 text-right font-mono">{l.clicks_total || 0}</td>
                      <td className="p-3 text-center">
                        <Badge variant={l.is_active ? "success" : "secondary"}>{l.is_active ? "ativo" : "pausado"}</Badge>
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
