"use client";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Mail, Phone, MapPin, Building2, Tag, X } from "lucide-react";

interface Lead {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  status?: string;
  origem?: string;
  origem_detalhe?: string;
  tags?: string[];
  valor_estimado?: number;
  ultimo_contato?: string;
  created_at: string;
  segmento?: string;
  cidade?: string;
  estado?: string;
}

const ETAPAS = [
  { id: "novo", label: "Novo", cor: "bg-gray-500/20 border-gray-500/30" },
  { id: "contato_feito", label: "Contato feito", cor: "bg-blue-500/20 border-blue-500/30" },
  { id: "qualificado", label: "Qualificado", cor: "bg-purple-500/20 border-purple-500/30" },
  { id: "agendado", label: "Agendado", cor: "bg-amber-500/20 border-amber-500/30" },
  { id: "reuniao_realizada", label: "Reunião feita", cor: "bg-cyan-500/20 border-cyan-500/30" },
  { id: "ganho", label: "Ganho", cor: "bg-green-500/20 border-green-500/30" },
  { id: "sem_interesse", label: "Perdido", cor: "bg-red-500/20 border-red-500/30" },
];

export function CRMGerencialUI({ leads }: { leads: Lead[] }) {
  const [filtros, setFiltros] = useState({
    busca: "",
    origem: "",
    status: "",
  });
  const [leadAberto, setLeadAberto] = useState<Lead | null>(null);

  const leadsFiltrados = useMemo(() => {
    return leads.filter((l) => {
      if (filtros.origem && l.origem !== filtros.origem) return false;
      if (filtros.status && l.status !== filtros.status) return false;
      if (filtros.busca) {
        const q = filtros.busca.toLowerCase();
        const matchTexto = [l.nome, l.empresa, l.email, l.telefone, l.cidade]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
        if (!matchTexto) return false;
      }
      return true;
    });
  }, [leads, filtros]);

  const origensUnicas = useMemo(() => {
    return Array.from(new Set(leads.map((l) => l.origem).filter(Boolean))) as string[];
  }, [leads]);

  const porEtapa = useMemo(() => {
    const acc: Record<string, Lead[]> = {};
    for (const etapa of ETAPAS) acc[etapa.id] = [];
    for (const l of leadsFiltrados) {
      const s = l.status || "novo";
      if (acc[s]) acc[s].push(l);
      else acc["novo"].push(l);
    }
    return acc;
  }, [leadsFiltrados]);

  return (
    <>
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px]">Busca</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Nome, empresa, email, telefone..."
                  value={filtros.busca}
                  onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Origem</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={filtros.origem}
                onChange={(e) => setFiltros({ ...filtros, origem: e.target.value })}
              >
                <option value="">Todas</option>
                {origensUnicas.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">Status</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              >
                <option value="">Todos</option>
                {ETAPAS.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>
          </div>
          {(filtros.busca || filtros.origem || filtros.status) && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {leadsFiltrados.length} resultados
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => setFiltros({ busca: "", origem: "", status: "" })}>
                <X className="h-3 w-3" /> Limpar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kanban */}
      <div className="overflow-x-auto -mx-2 px-2 mt-4">
        <div className="flex gap-3 min-w-max pb-2">
          {ETAPAS.map((etapa) => (
            <div key={etapa.id} className="w-[280px] flex-shrink-0">
              <div className={`${etapa.cor} border rounded-lg p-2 mb-2`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs uppercase tracking-wider">{etapa.label}</div>
                  <Badge variant="secondary" className="text-[10px]">{porEtapa[etapa.id]?.length || 0}</Badge>
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {(porEtapa[etapa.id] || []).map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setLeadAberto(lead)}
                    className="border border-border rounded-md p-2 bg-background/30 hover:bg-background/50 cursor-pointer text-xs space-y-1"
                  >
                    <div className="font-semibold">{lead.nome || lead.empresa || "Sem nome"}</div>
                    {lead.empresa && lead.nome && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-2.5 w-2.5" /> {lead.empresa}
                      </div>
                    )}
                    {lead.email && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="h-2.5 w-2.5" /> {lead.email}
                      </div>
                    )}
                    {lead.telefone && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" /> {lead.telefone}
                      </div>
                    )}
                    {lead.cidade && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> {lead.cidade}{lead.estado ? `/${lead.estado}` : ""}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {lead.origem && (
                        <Badge variant="outline" className="text-[9px]">
                          {lead.origem}
                        </Badge>
                      )}
                      {lead.tags?.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[9px]">
                          <Tag className="h-2 w-2 mr-1" /> {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {(porEtapa[etapa.id]?.length || 0) === 0 && (
                  <div className="text-center text-[10px] text-muted-foreground py-4">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal detalhe lead */}
      {leadAberto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setLeadAberto(null)}>
          <div className="bg-card border border-border rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold">{leadAberto.nome || leadAberto.empresa}</h2>
                <Badge variant="secondary" className="text-[10px] mt-1">{leadAberto.status || "novo"}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLeadAberto(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              {leadAberto.empresa && <div><span className="text-muted-foreground">Empresa:</span> <b>{leadAberto.empresa}</b></div>}
              {leadAberto.email && <div><span className="text-muted-foreground">Email:</span> <b>{leadAberto.email}</b></div>}
              {leadAberto.telefone && <div><span className="text-muted-foreground">Telefone:</span> <b>{leadAberto.telefone}</b></div>}
              {leadAberto.cidade && <div><span className="text-muted-foreground">Localização:</span> <b>{leadAberto.cidade}{leadAberto.estado ? `/${leadAberto.estado}` : ""}</b></div>}
              {leadAberto.origem && <div><span className="text-muted-foreground">Origem:</span> <b>{leadAberto.origem} {leadAberto.origem_detalhe ? `(${leadAberto.origem_detalhe})` : ""}</b></div>}
              {leadAberto.valor_estimado && <div><span className="text-muted-foreground">Valor estimado:</span> <b>R$ {leadAberto.valor_estimado.toLocaleString("pt-BR")}</b></div>}
              {leadAberto.ultimo_contato && <div><span className="text-muted-foreground">Último contato:</span> <b>{new Date(leadAberto.ultimo_contato).toLocaleString("pt-BR")}</b></div>}
              <div><span className="text-muted-foreground">Criado:</span> <b>{new Date(leadAberto.created_at).toLocaleString("pt-BR")}</b></div>

              <div className="pt-3 border-t border-border">
                <a href={`/leads?lead=${leadAberto.id}`} className="text-cyan hover:underline text-xs">
                  Ver perfil completo + histórico de atividades →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
