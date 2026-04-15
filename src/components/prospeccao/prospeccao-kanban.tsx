"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, Globe, MapPin, Star, Calendar, FileText } from "lucide-react";
import { LeadDetalheDialog } from "@/components/prospeccao/lead-detalhe";

interface Lead {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  whatsapp: string | null;
  website: string | null;
  has_website: boolean;
  email: string | null;
  categoria: string | null;
  rating: number | null;
  reviews_count: number | null;
  google_maps_url: string | null;
  status: string;
  prioridade: string;
  notas: string | null;
  assignee?: { full_name?: string } | null;
}

const COLUNAS = [
  { status: "novo", label: "Novo", color: "#64748b" },
  { status: "contato_feito", label: "Contato feito", color: "#06b6d4" },
  { status: "agendado", label: "Agendado", color: "#f59e0b" },
  { status: "reuniao_realizada", label: "Reuniao realizada", color: "#8b5cf6" },
  { status: "ganho", label: "Ganho", color: "#10b981" },
  { status: "perdido", label: "Perdido", color: "#ef4444" },
];

export function ProspeccaoKanban({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [selected, setSelected] = useState<Lead | null>(null);

  const onUpdate = (id: string, patch: Partial<Lead>) => {
    setLeads(leads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUNAS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.status);
          return (
            <div key={col.status} className="w-80 flex-shrink-0 bg-card/60 border border-border rounded-xl">
              <div className="p-3 border-b border-border flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                <div className="font-bold text-sm">{col.label}</div>
                <Badge variant="secondary" className="text-[10px]">{colLeads.length}</Badge>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {colLeads.map((l) => <LeadCard key={l.id} lead={l} onClick={() => setSelected(l)} />)}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <LeadDetalheDialog
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => onUpdate(selected.id, patch)}
        />
      )}
    </>
  );
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const telLink = lead.telefone ? `tel:${lead.telefone.replace(/\D/g, "")}` : null;
  const waLink = lead.whatsapp ? `https://wa.me/${lead.whatsapp}` : null;

  return (
    <Card className="cursor-pointer hover:border-cyan/30 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div onClick={onClick}>
          <div className="font-semibold text-sm leading-tight">{lead.nome}</div>
          {lead.categoria && <Badge variant="outline" className="text-[9px] mt-1">{lead.categoria}</Badge>}
        </div>

        {lead.endereco && (
          <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{lead.endereco}</span>
          </div>
        )}

        {lead.rating && (
          <div className="flex items-center gap-1 text-[11px]">
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
            <span className="font-semibold">{lead.rating}</span>
            <span className="text-muted-foreground">({lead.reviews_count || 0})</span>
            {!lead.has_website && <Badge variant="outline" className="text-[9px] ml-auto text-red-400 border-red-400/30">SEM SITE</Badge>}
          </div>
        )}

        <div className="flex items-center gap-1 pt-1">
          {telLink && (
            <a href={telLink} onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="outline" className="h-7 w-7" title={lead.telefone!}>
                <Phone className="h-3 w-3" />
              </Button>
            </a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="outline" className="h-7 w-7" title="WhatsApp">
                <MessageCircle className="h-3 w-3" />
              </Button>
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="outline" className="h-7 w-7" title={lead.website}>
                <Globe className="h-3 w-3" />
              </Button>
            </a>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto" title="Registrar atividade" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <FileText className="h-3 w-3" />
          </Button>
        </div>

        {lead.assignee?.full_name && (
          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
            Dono: {lead.assignee.full_name}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
