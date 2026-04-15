import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Target, Phone, Users, CheckCheck, Calendar } from "lucide-react";
import { NovaListaButton } from "@/components/prospeccao/nova-lista";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProspeccaoPage() {
  const supabase = await createClient();

  const [{ data: listas }, { data: todayAtividades }, { data: upcoming }] = await Promise.all([
    supabase.from("prospeccao_listas").select("*").order("created_at", { ascending: false }),
    supabase.from("prospeccao_atividades").select("id,tipo")
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from("prospeccao_agendamentos").select("id")
      .gte("data_reuniao", new Date().toISOString()).eq("status", "agendado"),
  ]);

  const { data: leadsStatus } = await supabase.from("prospeccao_leads")
    .select("status");

  const counts: Record<string, number> = {};
  (leadsStatus || []).forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
  const totalLeads = (leadsStatus || []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Prospeccao Ativa</h1>
          <p className="text-muted-foreground">Gerador de leads B2B + operacao comercial.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/prospeccao/produtividade">
            <span className="inline-flex items-center gap-1 text-sm text-cyan hover:underline">
              Ver produtividade →
            </span>
          </Link>
          <NovaListaButton />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Users className="h-3 w-3" /> Total leads</div>
          <div className="text-3xl font-black mt-1">{totalLeads}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Phone className="h-3 w-3" /> Atividades hoje</div>
          <div className="text-3xl font-black mt-1 text-cyan">{(todayAtividades || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Calendar className="h-3 w-3" /> Reunioes marcadas</div>
          <div className="text-3xl font-black mt-1 text-yellow-400">{(upcoming || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><CheckCheck className="h-3 w-3" /> Ganhos</div>
          <div className="text-3xl font-black mt-1 text-green-400">{counts.ganho || 0}</div>
        </CardContent></Card>
      </div>

      {(listas || []).length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="font-bold text-lg mb-1">Nenhuma lista de prospeccao</div>
            <div className="text-sm text-muted-foreground mb-6">Gera uma lista com Google Places pra comecar a prospectar.</div>
            <NovaListaButton />
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(listas || []).map((l) => {
            type ListaCount = { leads_count?: Array<{ count: number }> };
            const leadsCount = (l as ListaCount).leads_count?.[0]?.count ?? 0;
            return (
              <Link key={l.id} href={`/prospeccao/${l.id}`}>
                <Card className="hover:border-cyan/30 transition-colors cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold">{l.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{l.segmento} · {l.cidade}{l.estado ? `/${l.estado}` : ""}</div>
                      </div>
                      <Badge variant={l.status === "ativa" ? "success" : "secondary"}>{l.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-3">
                      <span className="text-cyan font-bold">{leadsCount}</span> leads · criada {formatDate(l.created_at)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
