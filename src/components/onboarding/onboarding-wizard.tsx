"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X, Sparkles } from "lucide-react";

interface Progress {
  step_import_clients: boolean;
  step_connect_meta: boolean;
  step_create_agent_ia: boolean;
  step_create_first_charge: boolean;
  step_invite_team: boolean;
  step_configure_webhooks: boolean;
  completed: boolean;
}

export function OnboardingWizard() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding-progress").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) setProgress(d);
      if (localStorage.getItem("onboarding_dismissed") === "true") setDismissed(true);
    });
  }, []);

  if (!progress || progress.completed || dismissed) return null;

  const steps = [
    { key: "step_import_clients", label: "Importar clientes", href: "/clientes", desc: "Importe seus 30+ clientes existentes em 1 clique no Dashboard" },
    { key: "step_connect_meta", label: "Conectar Meta Ads", href: "/integracoes", desc: "Conecte a conta de anuncios do seu cliente" },
    { key: "step_create_agent_ia", label: "Ativar agente IA", href: "/atendimento-ia", desc: "Configure o primeiro agente pra atender clientes" },
    { key: "step_create_first_charge", label: "Primeira cobranca", href: "/cobrancas", desc: "Teste a integracao Asaas criando cobranca de R$ 5,00" },
    { key: "step_invite_team", label: "Convidar time", href: "/configuracoes", desc: "Adicione membros do time de trafego, social, video" },
    { key: "step_configure_webhooks", label: "Webhooks Meta", href: "/integracoes", desc: "Configure webhooks pra rastrear Instagram + comentarios" },
  ] as const;

  const completedCount = steps.filter((s) => progress[s.key as keyof Progress]).length;

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("onboarding_dismissed", "true");
  };

  return (
    <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan" />
            Setup do sistema ({completedCount}/{steps.length})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={dismiss} title="Esconder">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-500 to-cyan transition-all"
              style={{ width: `${(completedCount / steps.length) * 100}%` }} />
          </div>
        </div>
        <div className="space-y-2">
          {steps.map((s) => {
            const done = progress[s.key as keyof Progress];
            return (
              <div key={s.key} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${done ? "text-muted-foreground line-through" : ""}`}>{s.label}</div>
                  {!done && <div className="text-xs text-muted-foreground">{s.desc}</div>}
                </div>
                {!done && (
                  <Link href={s.href}><Button size="sm" variant="outline">Ir</Button></Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
