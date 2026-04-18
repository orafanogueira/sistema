"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, KanbanSquare, Megaphone, Handshake, Palette,
  Video, MessagesSquare, Mail, Bot, Plug, Settings, Building2,
  Target, Car, Zap, Workflow, Sparkles, Calendar, Image, Bell,
  Activity, Link2, FileText, DollarSign, Receipt, Instagram,
  MessageSquare, Search, Share2, Heart, Phone, Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { productsRequiredFor } from "@/lib/access/products";

const NAV = [
  { section: "Geral", items: [
    { href: "/dashboard", label: "Dashboard CEO", icon: LayoutDashboard },
    { href: "/alertas", label: "Alertas", icon: Bell },
    { href: "/clientes", label: "Clientes", icon: Users },
  ]},
  { section: "Conteudo", items: [
    { href: "/social", label: "Social Media", icon: Image },
    { href: "/calendario", label: "Calendario", icon: Calendar },
    { href: "/automacoes-ig", label: "Automacoes IG", icon: Instagram },
  ]},
  { section: "CRM", items: [
    { href: "/leads", label: "Leads", icon: Target },
    { href: "/prospeccao", label: "Prospeccao ativa", icon: Phone },
    { href: "/rastreamento", label: "Rastreamento", icon: Activity },
    { href: "/jornadas", label: "Jornadas", icon: Workflow },
    { href: "/links-rastreaveis", label: "Links", icon: Link2 },
    { href: "/pipelines", label: "Pipelines", icon: Workflow },
    { href: "/automacoes", label: "Automacoes", icon: Zap },
    { href: "/kanban", label: "Kanban (tarefas)", icon: KanbanSquare },
  ]},
  { section: "Automotivo", items: [
    { href: "/estoque", label: "Estoque", icon: Car },
    { href: "/vendedores", label: "Vendedores", icon: Handshake },
  ]},
  { section: "Financeiro", items: [
    { href: "/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/contratos", label: "Contratos", icon: FileText },
    { href: "/cobrancas", label: "Cobrancas", icon: Receipt },
  ]},
  { section: "IA", items: [
    { href: "/copiloto", label: "Copiloto IA", icon: MessageSquare },
    { href: "/agentes-ia", label: "Agentes IA", icon: Sparkles },
    { href: "/atendimento-ia", label: "Atendimento IA", icon: Bot },
    { href: "/criativos", label: "Criativos IA", icon: Image },
    { href: "/youtube", label: "YouTube IA", icon: Youtube },
  ]},
  { section: "Performance", items: [
    { href: "/utm-builder", label: "UTM Builder", icon: Link2 },
    { href: "/seo", label: "SEO / Organico", icon: Search },
    { href: "/customer-success", label: "Customer Success", icon: Heart },
    { href: "/maxxima", label: "Maquina Maxxima", icon: Zap },
  ]},
  { section: "Times", items: [
    { href: "/times/trafego", label: "Trafego Pago", icon: Megaphone },
    { href: "/times/comercial", label: "Comercial", icon: Handshake },
    { href: "/times/social", label: "Social Media", icon: Palette },
    { href: "/times/video", label: "Video Maker", icon: Video },
  ]},
  { section: "Atendimento", items: [
    { href: "/followup", label: "Follow-up", icon: Mail },
    { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  ]},
  { section: "Sistema", items: [
    { href: "/integracoes", label: "Integracoes", icon: Plug },
    { href: "/planos", label: "Planos & Soluções", icon: Sparkles },
    { href: "/configuracoes", label: "Configuracoes", icon: Settings },
  ]},
];

export function Sidebar({ tenantName, activeProducts = [], isMaster = false, userRole = "owner" }: { tenantName: string; activeProducts?: string[]; isMaster?: boolean; userRole?: string }) {
  const pathname = usePathname();
  const isAdminUser = userRole === "owner" || userRole === "admin";

  // rotas que editor/readonly NAO veem
  const adminOnlyPaths = ["/financeiro", "/cobrancas", "/contratos", "/assinaturas", "/configuracoes", "/dashboard"];

  // filtra items por produto ativo + role
  const filteredNav = NAV
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => {
        // editor/readonly nao ve financeiro/dashboard/configuracoes
        if (!isAdminUser && adminOnlyPaths.some((p) => it.href === p || it.href.startsWith(p + "/"))) return false;
        const required = productsRequiredFor(it.href);
        if (isMaster) return true;
        if (!required) return true;
        return required.some((p) => activeProducts.includes(p));
      }),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card/40 border-r border-border flex flex-col glass">
      <div className="h-16 px-5 flex items-center border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Nogueira OS</div>
            <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">{tenantName}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {filteredNav.map((sec) => (
          <div key={sec.section}>
            <div className="px-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {sec.section}
            </div>
            <div className="space-y-0.5">
              {sec.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <Link key={it.href} href={it.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      active ? "bg-gradient-to-r from-brand-500/20 to-cyan/10 text-white border border-cyan/20" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}>
                    <Icon className="h-4 w-4" />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-border text-[11px] text-muted-foreground">
        v0.1.0 · Grupo Nogueira
      </div>
    </aside>
  );
}
