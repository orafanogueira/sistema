import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, Trophy, Phone, MessageCircle, Calendar, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface AtividadeRow {
  user_id: string | null;
  tipo: string;
  resultado: string | null;
  duracao_seg: number | null;
  created_at: string;
  user: { full_name?: string | null; email?: string | null } | null;
}
interface AgendamentoRow {
  user_id: string | null;
  status: string;
  data_reuniao: string;
  user: { full_name?: string | null; email?: string | null } | null;
}

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

export default async function ProdutividadePage() {
  const supabase = await createClient();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: atvHoje }, { data: atv7d }, { data: agds }, { data: leadsGanhos }] = await Promise.all([
    supabase.from("prospeccao_atividades")
      .select("user_id,tipo,resultado,duracao_seg,created_at,user:profiles(full_name,email)")
      .gte("created_at", todayStart),
    supabase.from("prospeccao_atividades")
      .select("user_id,tipo,resultado,duracao_seg,created_at,user:profiles(full_name,email)")
      .gte("created_at", sevenDaysAgo),
    supabase.from("prospeccao_agendamentos")
      .select("user_id,status,data_reuniao,user:profiles(full_name,email)")
      .gte("data_reuniao", sevenDaysAgo),
    supabase.from("prospeccao_leads").select("assigned_to").eq("status", "ganho"),
  ]);

  const hoje = (atvHoje || []) as unknown as AtividadeRow[];
  const week = (atv7d || []) as unknown as AtividadeRow[];
  const weekAgds = (agds || []) as unknown as AgendamentoRow[];

  type Stat = {
    user_id: string; nome: string;
    ligacoes: number; whatsapps: number; emails: number;
    tempo_call_seg: number; agendamentos: number; ganhos: number;
    atendidas: number; pediu_retorno: number;
  };

  const statsMap = new Map<string, Stat>();
  const getStat = (row: AtividadeRow | AgendamentoRow): Stat => {
    const uid = row.user_id || "_nenhum_";
    if (!statsMap.has(uid)) {
      statsMap.set(uid, {
        user_id: uid,
        nome: row.user?.full_name || row.user?.email || "Sem vendedor",
        ligacoes: 0, whatsapps: 0, emails: 0,
        tempo_call_seg: 0, agendamentos: 0, ganhos: 0,
        atendidas: 0, pediu_retorno: 0,
      });
    }
    return statsMap.get(uid)!;
  };

  week.forEach((a) => {
    const s = getStat(a);
    if (a.tipo === "ligacao") s.ligacoes++;
    if (a.tipo === "whatsapp") s.whatsapps++;
    if (a.tipo === "email") s.emails++;
    if (a.duracao_seg) s.tempo_call_seg += a.duracao_seg;
    if (a.resultado === "atendeu") s.atendidas++;
    if (a.resultado === "pediu_retorno") s.pediu_retorno++;
  });

  weekAgds.forEach((g) => {
    if (g.status !== "cancelada") {
      const s = getStat(g);
      s.agendamentos++;
    }
  });

  const ranked = Array.from(statsMap.values()).sort((a, b) =>
    (b.ligacoes + b.whatsapps + b.agendamentos * 5) - (a.ligacoes + a.whatsapps + a.agendamentos * 5)
  );

  const totalLigacoesHoje = hoje.filter((a) => a.tipo === "ligacao").length;
  const totalWhatsHoje = hoje.filter((a) => a.tipo === "whatsapp").length;
  const totalAgdHoje = hoje.filter((a) => a.resultado === "agendou").length;
  const totalGanhos = (leadsGanhos || []).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/prospeccao" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-3xl font-black tracking-tight">Produtividade Comercial</h1>
        <p className="text-muted-foreground">Ranking da semana e atividade de hoje.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Phone className="h-3 w-3" /> Ligacoes hoje</div>
          <div className="text-3xl font-black mt-1">{totalLigacoesHoje}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><MessageCircle className="h-3 w-3" /> WhatsApp hoje</div>
          <div className="text-3xl font-black mt-1 text-cyan">{totalWhatsHoje}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><Calendar className="h-3 w-3" /> Agendadas hoje</div>
          <div className="text-3xl font-black mt-1 text-yellow-400">{totalAgdHoje}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Total ganhos</div>
          <div className="text-3xl font-black mt-1 text-green-400">{totalGanhos}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /> Ranking semana (ultimos 7 dias)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ranked.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Nenhuma atividade registrada ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Vendedor</th>
                  <th className="p-3 text-right">Ligacoes</th>
                  <th className="p-3 text-right">WhatsApp</th>
                  <th className="p-3 text-right">Tempo call</th>
                  <th className="p-3 text-right">Atendidas</th>
                  <th className="p-3 text-right">Agendou</th>
                  <th className="p-3 text-right">Taxa conv.</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, i) => {
                  const total = s.ligacoes + s.whatsapps;
                  const conv = total > 0 ? ((s.agendamentos / total) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={s.user_id} className="border-b border-border">
                      <td className="p-3">
                        {i === 0 ? <Trophy className="h-4 w-4 text-yellow-400" /> :
                         i === 1 ? <Trophy className="h-4 w-4 text-gray-400" /> :
                         i === 2 ? <Trophy className="h-4 w-4 text-orange-400" /> :
                         <span className="text-muted-foreground">#{i + 1}</span>}
                      </td>
                      <td className="p-3 font-semibold">{s.nome}</td>
                      <td className="p-3 text-right">{s.ligacoes}</td>
                      <td className="p-3 text-right">{s.whatsapps}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatDuration(s.tempo_call_seg)}</td>
                      <td className="p-3 text-right">{s.atendidas}</td>
                      <td className="p-3 text-right"><Badge variant="success">{s.agendamentos}</Badge></td>
                      <td className="p-3 text-right font-bold text-cyan">{conv}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Proximas reunioes</CardTitle></CardHeader>
        <CardContent>
          <UpcomingReunioes />
        </CardContent>
      </Card>
    </div>
  );
}

async function UpcomingReunioes() {
  const supabase = await createClient();
  const { data: upcoming } = await supabase.from("prospeccao_agendamentos")
    .select("*,lead:prospeccao_leads(nome,telefone),user:profiles(full_name)")
    .gte("data_reuniao", new Date().toISOString())
    .eq("status", "agendado")
    .order("data_reuniao").limit(10);

  if (!upcoming || upcoming.length === 0) {
    return <div className="text-sm text-muted-foreground">Nenhuma reuniao marcada.</div>;
  }

  return (
    <div className="space-y-2">
      {upcoming.map((a) => {
        const user = a.user as { full_name?: string } | null;
        const lead = a.lead as { nome?: string; telefone?: string } | null;
        return (
          <div key={a.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 text-sm">
            <div>
              <div className="font-semibold">{a.titulo}</div>
              <div className="text-xs text-muted-foreground">{lead?.nome} · {user?.full_name || "Sem vendedor"}</div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {new Date(a.data_reuniao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
