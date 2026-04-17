import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente: clienteId } = await searchParams;
  const supabase = await createClient();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

  let q = supabase.from("social_posts")
    .select("id,title,format,pillar,status,scheduled_for,published_at,cliente:clientes(nome)")
    .or(`scheduled_for.gte.${start},published_at.gte.${start}`)
    .lte("scheduled_for", end);
  if (clienteId) q = q.eq("cliente_id", clienteId);
  const { data: posts } = await q;

  // monta grade do mes
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const monthLabel = today.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const postsByDay: Record<number, typeof posts> = {};
  for (const p of posts || []) {
    const d = p.scheduled_for ? new Date(p.scheduled_for) : p.published_at ? new Date(p.published_at) : null;
    if (!d || d.getMonth() !== today.getMonth()) continue;
    const day = d.getDate();
    postsByDay[day] = postsByDay[day] || [];
    postsByDay[day].push(p);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Calendario Editorial</h1>
        <p className="text-muted-foreground capitalize">{monthLabel}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2 mb-2 text-[11px] uppercase text-muted-foreground font-bold tracking-wider text-center">
            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sab</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {blanks.map((b) => <div key={`b${b}`} />)}
            {days.map((d) => {
              const dayPosts = postsByDay[d] || [];
              const isToday = d === today.getDate();
              return (
                <div key={d} className={`min-h-[100px] p-2 rounded-lg border ${isToday ? "border-cyan bg-cyan/5" : "border-border bg-secondary/20"}`}>
                  <div className={`text-xs font-bold mb-1 ${isToday ? "text-cyan" : ""}`}>{d}</div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((p) => {
                      const cliente = p.cliente as { nome?: string } | null;
                      return (
                        <Link key={p.id} href={`/social`} className="block">
                          <div className={`text-[10px] p-1 rounded truncate ${p.status === "publicado" ? "bg-green-500/20 text-green-300" : p.status === "agendado" ? "bg-cyan/20 text-cyan" : p.status === "aguardando_aprovacao" ? "bg-yellow-500/20 text-yellow-300" : "bg-secondary text-muted-foreground"}`}>
                            {p.format} · {cliente?.nome?.slice(0, 12) || ""}
                          </div>
                        </Link>
                      );
                    })}
                    {dayPosts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayPosts.length - 3} mais</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4 text-xs">
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-green-500/30" /> Publicado</div>
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-cyan/30" /> Agendado</div>
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-yellow-500/30" /> Aguardando aprovacao</div>
      </div>
    </div>
  );
}
