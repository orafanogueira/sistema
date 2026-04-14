import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AGENT_CATALOG } from "@/lib/ai-agents/catalog";
import { Sparkles, Zap, Crown } from "lucide-react";

const DOMAIN_LABELS: Record<string, string> = {
  social: "Social Media",
  trafego: "Trafego Pago",
  comercial: "Comercial",
};

const DOMAIN_COLORS: Record<string, string> = {
  social: "from-pink-500 to-purple-500",
  trafego: "from-blue-500 to-cyan",
  comercial: "from-green-500 to-emerald-500",
};

export default function AgentesPage() {
  const grouped: Record<string, typeof AGENT_CATALOG> = {};
  for (const a of AGENT_CATALOG) {
    grouped[a.domain] = grouped[a.domain] || [];
    grouped[a.domain].push(a);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Agentes IA</h1>
        <p className="text-muted-foreground">{AGENT_CATALOG.length} agentes pre-configurados pra acelerar a operacao da agencia.</p>
      </div>

      {Object.entries(grouped).map(([domain, agents]) => (
        <div key={domain}>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <span className={`h-7 w-7 rounded-md bg-gradient-to-br ${DOMAIN_COLORS[domain]} flex items-center justify-center`}>
              <Sparkles className="h-4 w-4" />
            </span>
            {DOMAIN_LABELS[domain]} · {agents.length} agentes
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => (
              <Link key={a.key} href={`/agentes-ia/${a.key}`}>
                <Card className="hover:border-cyan/30 transition-colors h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${DOMAIN_COLORS[a.domain]} flex items-center justify-center`}>
                        <Sparkles className="h-4 w-4" />
                      </div>
                      {a.is_pro && <Badge variant="warning" className="text-[9px]"><Crown className="h-3 w-3 mr-0.5" /> PRO</Badge>}
                    </div>
                    <div className="font-bold text-sm mb-1">{a.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-3">{a.description}</div>
                    <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{a.output_format}</Badge>
                      <Badge variant="outline" className="text-[10px]">temp {a.recommended_temperature}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
