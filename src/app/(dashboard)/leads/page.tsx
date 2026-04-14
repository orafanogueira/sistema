import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Phone, Car, Calendar } from "lucide-react";
import { formatDate, formatBRL } from "@/lib/utils";

const ORIGEM_COLORS: Record<string, string> = {
  meta_ads_facebook: "bg-blue-500/20 text-blue-300",
  meta_ads_instagram: "bg-pink-500/20 text-pink-300",
  google_ads_search: "bg-green-500/20 text-green-300",
  google_ads_youtube: "bg-red-500/20 text-red-300",
  webmotors: "bg-orange-500/20 text-orange-300",
  mobiauto: "bg-purple-500/20 text-purple-300",
  icarros: "bg-cyan-500/20 text-cyan-300",
  olx: "bg-yellow-500/20 text-yellow-300",
  mercadolivre: "bg-yellow-600/20 text-yellow-400",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ cliente?: string; status?: string; origem?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let q = supabase.from("leads")
    .select("id,nome,telefone,whatsapp,modelo_interesse,marca_interesse,origem,origem_detalhe,status,valor_estimado,created_at,vendedor:vendedores(nome),stage:pipeline_stages(name,color),cliente:clientes(nome)")
    .order("created_at", { ascending: false }).limit(100);
  if (sp.cliente) q = q.eq("cliente_id", sp.cliente);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.origem) q = q.eq("origem", sp.origem);

  const { data: leads } = await q;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Leads</h1>
          <p className="text-muted-foreground">{(leads || []).length} lead(s) - inclui captura via webhook, email e Meta Lead Forms.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Exportar</Button>
          <Button><Plus className="h-4 w-4" /> Novo lead manual</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {(leads || []).length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div className="font-bold mb-2">Nenhum lead ainda</div>
              <div className="text-sm">Configure webhook nos portais ou Meta Lead Form.</div>
              <Link href="/integracoes" className="text-cyan font-semibold text-sm mt-4 inline-block">Ver como conectar →</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Lead</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Interesse</th>
                  <th className="p-3 text-left">Origem</th>
                  <th className="p-3 text-left">Estagio</th>
                  <th className="p-3 text-left">Vendedor</th>
                  <th className="p-3 text-left">Entrada</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(leads || []).map((l) => {
                  const cliente = l.cliente as { nome?: string } | null;
                  const stage = l.stage as { name?: string; color?: string } | null;
                  const vend = l.vendedor as { nome?: string } | null;
                  return (
                    <tr key={l.id} className="border-b border-border hover:bg-secondary/40">
                      <td className="p-3">
                        <Link href={`/leads/${l.id}`} className="font-semibold hover:text-cyan">{l.nome || "Sem nome"}</Link>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          {l.whatsapp && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.whatsapp}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{cliente?.nome || "-"}</td>
                      <td className="p-3">
                        {l.modelo_interesse ? (
                          <span className="flex items-center gap-1 text-sm"><Car className="h-3 w-3 text-cyan" />{l.marca_interesse} {l.modelo_interesse}</span>
                        ) : "-"}
                      </td>
                      <td className="p-3">
                        <Badge className={`text-[10px] ${ORIGEM_COLORS[l.origem] || ""}`} variant="outline">{l.origem.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="p-3">
                        {stage?.name ? (
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${stage.color}33`, color: stage.color || "#fff" }}>{stage.name}</span>
                        ) : <Badge variant="secondary">{l.status}</Badge>}
                      </td>
                      <td className="p-3 text-muted-foreground">{vend?.nome || "-"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(l.created_at)}</td>
                      <td className="p-3">
                        <Link href={`/leads/${l.id}`}><Button variant="ghost" size="sm">Abrir</Button></Link>
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

import { Target } from "lucide-react";
