import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Image, Video, Layers, Eye } from "lucide-react";
import { formatDate, formatInt } from "@/lib/utils";
import { NovoPostButton } from "@/components/social/novo-post";
import { EditorVideoButton } from "@/components/social/editor-video";

const STATUS_COLORS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  ideia: "secondary", rascunho: "secondary", aguardando_aprovacao: "warning",
  aprovado: "default", agendado: "default", publicado: "success",
  rejeitado: "destructive", arquivado: "secondary",
};

const FORMAT_ICONS: Record<string, React.ElementType> = {
  feed: Image, reel: Video, carrossel: Layers, story: Eye, video: Video, foto: Image,
};

export default async function SocialPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("social_posts")
    .select("*,cliente:clientes(nome)")
    .order("created_at", { ascending: false }).limit(60);
  const { data: clientes } = await supabase.from("clientes").select("id,nome").order("nome");

  const stats = {
    total: (posts || []).length,
    publicados: (posts || []).filter((p) => p.status === "publicado").length,
    aguardando: (posts || []).filter((p) => p.status === "aguardando_aprovacao").length,
    agendados: (posts || []).filter((p) => p.status === "agendado").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Social Media</h1>
          <p className="text-muted-foreground">Operacao de conteudo de todos os clientes.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/calendario"><Button variant="outline">Calendario</Button></Link>
          <EditorVideoButton />
          <NovoPostButton clientes={clientes || []} />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Total</div><div className="text-2xl font-black mt-1">{formatInt(stats.total)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Publicados</div><div className="text-2xl font-black mt-1 text-green-400">{formatInt(stats.publicados)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Aguardando aprovacao</div><div className="text-2xl font-black mt-1 text-yellow-400">{formatInt(stats.aguardando)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Agendados</div><div className="text-2xl font-black mt-1 text-cyan">{formatInt(stats.agendados)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Posts recentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(posts || []).length === 0 ? (
            <div className="p-16 text-center">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="font-bold text-lg mb-1">Sem posts cadastrados</div>
              <div className="text-sm text-muted-foreground mb-6">Use os agentes IA pra criar conteudo em segundos.</div>
              <Link href="/agentes-ia"><Button>Criar com IA</Button></Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Post</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Formato</th>
                  <th className="p-3 text-left">Pilar</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Agendado</th>
                </tr>
              </thead>
              <tbody>
                {(posts || []).map((p) => {
                  const cliente = p.cliente as { nome?: string } | null;
                  const Icon = FORMAT_ICONS[p.format] || Image;
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-secondary/40">
                      <td className="p-3">
                        <div className="font-semibold line-clamp-1">{p.title || p.briefing?.slice(0, 60) || "Sem titulo"}</div>
                        {p.hook && <div className="text-[11px] text-muted-foreground line-clamp-1">{p.hook}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{cliente?.nome || "-"}</td>
                      <td className="p-3"><span className="flex items-center gap-1 text-xs"><Icon className="h-3 w-3" />{p.format}</span></td>
                      <td className="p-3"><Badge variant="outline" className="text-[10px]">{p.pillar}</Badge></td>
                      <td className="p-3"><Badge variant={STATUS_COLORS[p.status] || "secondary"}>{p.status.replace(/_/g, " ")}</Badge></td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(p.scheduled_for)}</td>
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
