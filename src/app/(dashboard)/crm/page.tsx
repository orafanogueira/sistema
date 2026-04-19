import { LayoutGrid, Users, TrendingUp, Target, Phone, MessageSquare, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { CRMGerencialUI } from "@/components/crm/crm-gerencial-ui";

export const dynamic = "force-dynamic";

export default async function CRMGerencialPage() {
  const supabase = await createClient();

  const { data: leads } = await supabase.from("prospeccao_leads")
    .select("id, nome, email, telefone, empresa, status, origem, origem_detalhe, tags, valor_estimado, ultimo_contato, created_at, segmento, cidade, estado")
    .order("updated_at", { ascending: false })
    .limit(500);

  // KPIs
  const total = (leads || []).length;
  const porStatus = (leads || []).reduce<Record<string, number>>((acc, l) => {
    const s = l.status || "novo";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const porOrigem = (leads || []).reduce<Record<string, number>>((acc, l) => {
    const o = l.origem || "manual";
    acc[o] = (acc[o] || 0) + 1;
    return acc;
  }, {});

  const agendados = porStatus["agendado"] || 0;
  const ganhos = porStatus["ganho"] || porStatus["reuniao_realizada"] || 0;
  const taxaConversao = total > 0 ? ((ganhos / total) * 100).toFixed(1) : "0";

  // atividades do mês
  const ums = new Date();
  ums.setDate(1); ums.setHours(0, 0, 0, 0);
  const { count: ativMes } = await supabase.from("prospeccao_atividades")
    .select("*", { count: "exact", head: true })
    .gte("created_at", ums.toISOString());

  // ligacoes do mes
  const { count: ligMes } = await supabase.from("ligacoes")
    .select("*", { count: "exact", head: true })
    .gte("created_at", ums.toISOString());

  // disparos do mes
  const { count: dispMes } = await supabase.from("disparo_mensagens")
    .select("*", { count: "exact", head: true })
    .gte("created_at", ums.toISOString());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <LayoutGrid className="h-7 w-7 text-cyan" /> CRM Gerencial
        </h1>
        <p className="text-muted-foreground">
          Visão unificada de todos os leads — disparos WhatsApp/Email, Apollo, ligações IA, Instagram, Facebook Groups e WhatsApp Groups em um só lugar.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase">Total leads</div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-black mt-1">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase">Agendados</div>
              <Target className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black mt-1 text-amber-400">{agendados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase">Taxa conversão</div>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-3xl font-black mt-1 text-green-500">{taxaConversao}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase">Ativ. do mês</div>
              <div className="flex gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <Mail className="h-3 w-3" />
                <Phone className="h-3 w-3" />
              </div>
            </div>
            <div className="text-3xl font-black mt-1">{(ativMes || 0) + (ligMes || 0)}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {dispMes || 0} disparos · {ligMes || 0} ligações
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Por origem */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase mb-3">Leads por origem</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(porOrigem).map(([origem, qtd]) => (
              <div key={origem} className="bg-background/40 border border-border rounded-md px-3 py-2 text-xs">
                <span className="text-muted-foreground">{origem}:</span> <b className="text-cyan">{qtd}</b>
              </div>
            ))}
            {Object.keys(porOrigem).length === 0 && (
              <div className="text-xs text-muted-foreground">Sem leads ainda</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kanban + filtros */}
      <CRMGerencialUI leads={leads || []} />
    </div>
  );
}
