import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus } from "lucide-react";
import Link from "next/link";

interface Props {
  team: "trafego" | "comercial" | "social" | "video";
  title: string;
  description: string;
  icon: React.ElementType;
}

export async function TimePage({ team, title, description, icon: Icon }: Props) {
  const supabase = await createClient();
  const { data: membros } = await supabase
    .from("memberships")
    .select("id,role,team,profile:profiles(full_name,email,avatar_url)")
    .eq("team", team);

  const { data: boards } = await supabase.from("boards").select("id,name").eq("team", team);
  const { data: tasks } = await supabase.from("tasks")
    .select("id,title,priority,due_date,cliente:clientes(nome)")
    .in("board_id", (boards || []).map((b) => b.id))
    .order("due_date", { ascending: true })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><UserPlus className="h-4 w-4" /> Convidar</Button>
          <Link href={`/kanban?team=${team}`}><Button>Abrir Kanban</Button></Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Membros</div>
          <div className="text-3xl font-black mt-1 text-cyan">{(membros || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Boards ativos</div>
          <div className="text-3xl font-black mt-1 text-green-400">{(boards || []).length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase">Tarefas em aberto</div>
          <div className="text-3xl font-black mt-1 text-yellow-400">{(tasks || []).length}</div>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Membros do time</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(membros || []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nenhum membro. Convide sua equipe.</div>
            ) : (membros || []).map((m) => {
              const p = m.profile as { full_name?: string; email?: string } | null;
              const initials = (p?.full_name || p?.email || "?").split(" ").map((x: string) => x[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 hover:bg-secondary rounded-md">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center text-xs font-bold">{initials}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{p?.full_name || p?.email}</div>
                    <div className="text-xs text-muted-foreground">{m.role}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Proximas tarefas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(tasks || []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa. Crie um board.</div>
            ) : (tasks || []).map((t) => {
              const cliente = t.cliente as { nome?: string } | null;
              return (
                <div key={t.id} className="flex items-center gap-3 p-2 hover:bg-secondary rounded-md">
                  <Badge variant={t.priority === "urgent" ? "destructive" : t.priority === "high" ? "warning" : "secondary"} className="text-[10px]">{t.priority}</Badge>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{cliente?.nome || "-"}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
