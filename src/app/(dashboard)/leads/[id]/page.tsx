import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, Car, MessageCircle, Calendar, DollarSign, Tag, User } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/utils";

export default async function LeadDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*,vendedor:vendedores(nome,whatsapp),stage:pipeline_stages(name,color),veiculo:veiculos(marca,modelo,ano,preco,fotos),cliente:clientes(nome)")
    .eq("id", id).maybeSingle();
  if (!lead) notFound();

  const { data: activities } = await supabase
    .from("lead_activities").select("*,vendedor:vendedores(nome)")
    .eq("lead_id", id).order("created_at", { ascending: false }).limit(50);

  const { data: financ } = await supabase
    .from("financiamentos").select("*").eq("lead_id", id).order("created_at", { ascending: false });

  const cliente = lead.cliente as { nome?: string } | null;
  const stage = lead.stage as { name?: string; color?: string } | null;
  const vend = lead.vendedor as { nome?: string; whatsapp?: string } | null;
  const veic = lead.veiculo as { marca?: string; modelo?: string; ano?: number; preco?: number; fotos?: { url: string }[] } | null;
  const fotos = veic?.fotos || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black">{lead.nome || "Sem nome"}</h1>
            {stage?.name && (
              <span className="text-xs px-3 py-1 rounded-full font-bold" style={{ backgroundColor: `${stage.color}33`, color: stage.color || "#fff" }}>{stage.name}</span>
            )}
            <Badge variant="outline">{lead.origem.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Cliente: {cliente?.nome} · Capturado em {formatDate(lead.created_at)}</p>
        </div>
        {lead.whatsapp && (
          <a href={`https://wa.me/${lead.whatsapp}`} target="_blank">
            <Button><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
          </a>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Contato</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-cyan" /> {lead.whatsapp || lead.telefone || "-"}</div>
            <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-cyan" /> {lead.email || "-"}</div>
            <div className="text-muted-foreground">{lead.cidade}{lead.estado ? `/${lead.estado}` : ""}</div>
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Car className="h-4 w-4" /> Interesse</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>{lead.marca_interesse} {lead.modelo_interesse} {lead.ano_interesse ? `(${lead.ano_interesse})` : ""}</div>
            {lead.preco_max && <div className="text-muted-foreground">Ate {formatBRL(Number(lead.preco_max))}</div>}
            {veic && <div className="text-cyan font-semibold">{formatBRL(Number(veic.preco))}</div>}
            {lead.forma_pagamento && <Badge variant="outline">{lead.forma_pagamento}</Badge>}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Atribuicao</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="font-semibold">{vend?.nome || "Sem vendedor"}</div>
            <div className="text-muted-foreground text-xs">{vend?.whatsapp || "-"}</div>
            <div className="text-xs mt-2">Status: <Badge>{lead.status}</Badge></div>
          </CardContent>
        </Card>
      </div>

      {fotos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Fotos do veiculo de interesse</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {fotos.slice(0, 8).map((f, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={f.url} alt="" className="rounded-lg aspect-video object-cover" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
            {(activities || []).map((a) => (
              <div key={a.id} className="flex gap-3 pb-3 border-b border-border last:border-0">
                <div className="h-2 w-2 rounded-full bg-cyan mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{formatDate(a.created_at)} · <Badge variant="outline" className="text-[10px]">{a.type}</Badge></div>
                  <div className="text-sm">{a.content}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financiamentos / Propostas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(financ || []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma simulacao ainda.</div>
            ) : (financ || []).map((f) => (
              <div key={f.id} className="p-3 rounded-lg bg-secondary text-sm">
                <div className="font-semibold">{f.parcelas}x de {formatBRL(Number(f.valor_parcela))}</div>
                <div className="text-xs text-muted-foreground">Entrada {formatBRL(Number(f.entrada))} · Taxa {Number(f.taxa_mensal) * 100}% a.m.</div>
                <Badge variant="outline" className="mt-2">{f.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
