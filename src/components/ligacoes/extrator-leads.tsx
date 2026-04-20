"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Search, CheckSquare, Square, PhoneCall } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface LeadGoogle {
  nome: string;
  telefone?: string;
  endereco?: string;
  site?: string;
  rating?: number;
  tipo?: string;
  cidade?: string;
}

interface Props {
  onUsarLeads: (leads: LeadGoogle[]) => void;
}

const NICHOS_COMUNS = [
  "Loja de carros usados",
  "Multimarcas",
  "Revenda de veículos",
  "Clínica de estética",
  "Dentista",
  "Advogado",
  "Imobiliária",
  "Academia",
  "Pet shop",
  "Restaurante",
];

export function ExtratorLeads({ onUsarLeads }: Props) {
  const [form, setForm] = useState({
    nicho: "",
    cidade: "",
    max: 20,
  });
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadGoogle[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  const extrair = async () => {
    if (!form.nicho.trim()) return toast.error("Informe o nicho");
    if (!form.cidade.trim()) return toast.error("Informe a cidade");
    setLoading(true);
    setLeads([]);
    setSelecionados(new Set());
    try {
      const r = await fetch("/api/ligacoes/extrair-google-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (data.erro) {
        toast.error("Erro", data.erro);
        return;
      }
      setLeads(data.leads || []);
      // pré-seleciona todos com telefone
      const preSel = new Set<number>();
      (data.leads || []).forEach((l: LeadGoogle, i: number) => {
        if (l.telefone) preSel.add(i);
      });
      setSelecionados(preSel);
      toast.success(
        `${data.total} leads encontrados`,
        `${data.com_telefone} com telefone (pré-selecionados)`
      );
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  const toggleLead = (idx: number) => {
    const novo = new Set(selecionados);
    if (novo.has(idx)) novo.delete(idx);
    else novo.add(idx);
    setSelecionados(novo);
  };

  const selecionarTodos = () => {
    const todos = new Set<number>();
    leads.forEach((l, i) => {
      if (l.telefone) todos.add(i);
    });
    setSelecionados(todos);
  };

  const usarSelecionados = () => {
    const selec = leads.filter((_, i) => selecionados.has(i) && leads[i].telefone);
    if (selec.length === 0) return toast.error("Selecione pelo menos um lead com telefone");
    onUsarLeads(selec);
    toast.success(`${selec.length} leads enviados pra campanha`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4 text-cyan" /> Extrair leads do Google Maps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_1fr_80px] gap-3">
          <div>
            <Label>Nicho</Label>
            <Input
              className="mt-1"
              placeholder="lojas de carros usados"
              value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value })}
            />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input
              className="mt-1"
              placeholder="Recife"
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            />
          </div>
          <div>
            <Label>Máx</Label>
            <Input
              type="number"
              className="mt-1"
              min={5}
              max={100}
              value={form.max}
              onChange={(e) => setForm({ ...form, max: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {NICHOS_COMUNS.map((n) => (
            <Button
              key={n}
              size="sm"
              variant="outline"
              className="text-[10px] h-7"
              onClick={() => setForm({ ...form, nicho: n })}
            >
              {n}
            </Button>
          ))}
        </div>

        <Button onClick={extrair} disabled={loading} className="w-full">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo do Google Maps...</>
          ) : (
            <><Search className="h-4 w-4" /> Extrair empresas</>
          )}
        </Button>

        {leads.length > 0 && (
          <>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="flex gap-2">
                <Badge variant="success">{leads.filter((l) => l.telefone).length} com telefone</Badge>
                <Badge variant="secondary">{selecionados.size} selecionados</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selecionarTodos}>
                  <CheckSquare className="h-3 w-3" /> Selecionar todos
                </Button>
                <Button size="sm" onClick={usarSelecionados}>
                  <PhoneCall className="h-3 w-3" /> Usar na campanha ({selecionados.size})
                </Button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto border border-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-card sticky top-0 border-b">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-left">Empresa</th>
                    <th className="p-2 text-left">Telefone</th>
                    <th className="p-2 text-left">Rating</th>
                    <th className="p-2 text-left">Endereço</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border cursor-pointer hover:bg-background/40 ${
                        !lead.telefone ? "opacity-40" : ""
                      }`}
                      onClick={() => lead.telefone && toggleLead(i)}
                    >
                      <td className="p-2">
                        {selecionados.has(i) ? (
                          <CheckSquare className="h-4 w-4 text-cyan" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="p-2 font-semibold">{lead.nome}</td>
                      <td className="p-2 font-mono text-[10px]">
                        {lead.telefone || <span className="text-muted-foreground">sem tel</span>}
                      </td>
                      <td className="p-2">
                        {lead.rating ? (
                          <Badge variant="secondary" className="text-[9px]">⭐ {lead.rating}</Badge>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-[10px] text-muted-foreground max-w-[250px] truncate">
                        {lead.endereco || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="text-[10px] text-muted-foreground">
          Fonte: Google Maps via Serper. ~$0.01 por busca. Custa 1 crédito por nicho+cidade.
        </div>
      </CardContent>
    </Card>
  );
}
