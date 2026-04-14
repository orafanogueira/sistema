import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Bot, KanbanSquare, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(0,85,204,.25),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(0,200,224,.15),transparent_50%)]" />

      <header className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-500 to-cyan" />
          <div>
            <div className="font-bold text-lg">Grupo Nogueira</div>
            <div className="text-[11px] text-muted-foreground -mt-1">Marketing & Performance OS</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"><Button variant="ghost">Entrar</Button></Link>
          <Link href="/signup"><Button>Criar conta</Button></Link>
        </div>
      </header>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 border border-cyan/20 text-xs font-bold text-cyan uppercase tracking-wider mb-8">
          Sistema operacional da sua agencia
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
          Tudo que sua agencia <span className="text-gradient">precisa</span>,
          <br /> em um lugar so.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Gerencie clientes, times, relatorios, follow-up e atendimento com IA.
          Integrado com Meta Ads, Google Ads, GA4, Gmail e WhatsApp.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup"><Button size="lg">Comecar gratis <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link href="/login"><Button size="lg" variant="outline">Ja tenho conta</Button></Link>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mt-24 text-left">
          {[
            { icon: BarChart3, t: "Dashboards em tempo real", d: "Meta Ads, Google Ads, GA4 em uma so visao." },
            { icon: KanbanSquare, t: "Kanban por time", d: "Trafego, Comercial, Social, Video." },
            { icon: Bot, t: "IA de atendimento", d: "Use internamente ou venda para clientes." },
            { icon: Zap, t: "Follow-up automatico", d: "Email + WhatsApp integrados." },
          ].map((f) => (
            <div key={f.t} className="p-5 rounded-xl bg-card border border-border">
              <f.icon className="h-6 w-6 text-cyan mb-3" />
              <div className="font-bold mb-1">{f.t}</div>
              <div className="text-sm text-muted-foreground">{f.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
