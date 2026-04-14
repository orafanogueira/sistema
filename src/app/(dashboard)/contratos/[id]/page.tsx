import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, CheckCircle2, FileText } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/utils";
import { EnviarAssinaturaButton } from "@/components/contratos/enviar-assinatura-button";

export const dynamic = "force-dynamic";

export default async function ContratoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contratos")
    .select("*,cliente:clientes(nome),signatarios:contrato_signatarios(*)")
    .eq("id", id).maybeSingle();
  if (!contrato) notFound();

  const { data: eventos } = await supabase.from("contrato_eventos")
    .select("*").eq("contrato_id", id).order("created_at", { ascending: false });

  const cliente = contrato.cliente as { nome?: string } | null;
  const signatarios = (contrato.signatarios as { id: string; nome: string; email: string; role: string; signed_at: string | null }[]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contratos"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black">{contrato.titulo}</h1>
            <Badge variant={contrato.status === "assinado" ? "success" : "warning"}>{contrato.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Cliente: {cliente?.nome} · Criado em {formatDate(contrato.created_at)}</p>
        </div>
        {contrato.status === "pronto" && signatarios.length > 0 && (
          <EnviarAssinaturaButton contratoId={contrato.id} />
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Valor</div><div className="text-xl font-bold mt-1">{contrato.valor ? formatBRL(Number(contrato.valor)) : "-"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Forma</div><div className="text-xl font-bold mt-1">{contrato.forma_pagamento || "-"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Inicio</div><div className="text-xl font-bold mt-1">{formatDate(contrato.data_inicio)}</div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Conteudo do contrato</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-secondary/40 p-4 rounded-md max-h-[500px] overflow-y-auto">{contrato.body}</pre>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Signatarios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {signatarios.map((s) => (
                <div key={s.id} className="flex items-start justify-between p-2 bg-secondary/40 rounded">
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-1">
                      {s.signed_at && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                      {s.nome}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{s.email}</div>
                    <Badge variant="outline" className="text-[9px] mt-1">{s.role}</Badge>
                  </div>
                  {s.signed_at && <Badge variant="success" className="text-[9px]">assinado</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>

          {contrato.clicksign_url && (
            <Card><CardContent className="p-4"><a href={contrato.clicksign_url} target="_blank"><Button variant="outline" className="w-full">Ver no Clicksign</Button></a></CardContent></Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(eventos || []).map((e) => (
                <div key={e.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                    <Badge variant="outline" className="text-[9px]">{e.type.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-muted-foreground ml-3.5">{formatDate(e.created_at)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
