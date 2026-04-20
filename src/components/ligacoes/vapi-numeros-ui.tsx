"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Phone, Star } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface VapiNumero {
  id: string;
  nome: string;
  telefone: string;
  country_code: string;
  vapi_phone_number_id: string;
  is_active: boolean;
  is_default: boolean;
  observacoes?: string;
}

const FLAGS: Record<string, string> = {
  BR: "🇧🇷", US: "🇺🇸", MX: "🇲🇽", UK: "🇬🇧", PT: "🇵🇹", ES: "🇪🇸",
};

export function VapiNumerosUI() {
  const [numeros, setNumeros] = useState<VapiNumero[]>([]);
  const [loading, setLoading] = useState(false);
  const [novo, setNovo] = useState({
    nome: "",
    vapi_phone_number_id: "",
    telefone: "",
    country_code: "BR",
    is_default: false,
    observacoes: "",
  });
  const [adicionando, setAdicionando] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/ligacoes/numeros");
      if (r.ok) setNumeros(await r.json());
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const adicionar = async () => {
    if (!novo.nome || !novo.vapi_phone_number_id || !novo.telefone) {
      return toast.error("Preencha nome, UUID Vapi e telefone");
    }
    setLoading(true);
    try {
      const r = await fetch("/api/ligacoes/numeros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novo),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Número adicionado");
      setNovo({ nome: "", vapi_phone_number_id: "", telefone: "", country_code: "BR", is_default: false, observacoes: "" });
      setAdicionando(false);
      load();
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const toggleDefault = async (id: string, atual: boolean) => {
    await fetch("/api/ligacoes/numeros", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_default: !atual }),
    });
    load();
  };

  const toggleAtivo = async (id: string, atual: boolean) => {
    await fetch("/api/ligacoes/numeros", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !atual }),
    });
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Remover esse número?")) return;
    await fetch(`/api/ligacoes/numeros?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4" /> Números Vapi
          </CardTitle>
          <Button size="sm" variant={adicionando ? "ghost" : "outline"} onClick={() => setAdicionando(!adicionando)}>
            {adicionando ? "Cancelar" : <><Plus className="h-3 w-3" /> Adicionar</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adicionando && (
          <div className="border border-cyan/30 bg-cyan/5 rounded p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome de exibição</Label>
                <Input className="mt-1" placeholder="Ex: BR São Paulo" value={novo.nome}
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              </div>
              <div>
                <Label>País (2 letras)</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={novo.country_code} onChange={(e) => setNovo({ ...novo, country_code: e.target.value })}>
                  <option value="BR">🇧🇷 Brasil</option>
                  <option value="US">🇺🇸 Estados Unidos</option>
                  <option value="MX">🇲🇽 México</option>
                  <option value="PT">🇵🇹 Portugal</option>
                  <option value="ES">🇪🇸 Espanha</option>
                  <option value="UK">🇬🇧 Reino Unido</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Telefone (E.164 — com +)</Label>
              <Input className="mt-1" placeholder="+17178831824 ou +5511988887777" value={novo.telefone}
                onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
            </div>
            <div>
              <Label>Vapi Phone Number ID (UUID)</Label>
              <Input className="mt-1 font-mono text-xs" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={novo.vapi_phone_number_id} onChange={(e) => setNovo({ ...novo, vapi_phone_number_id: e.target.value })} />
              <div className="text-[10px] text-muted-foreground mt-1">
                Pega em dashboard.vapi.ai/phone-numbers → copia o UUID do número.
              </div>
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Input className="mt-1" placeholder="Twilio local, para prospecção US..." value={novo.observacoes}
                onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={novo.is_default}
                onChange={(e) => setNovo({ ...novo, is_default: e.target.checked })} />
              <span>Número padrão (usado se não achar um pro país do lead)</span>
            </label>
            <Button onClick={adicionar} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar número"}
            </Button>
          </div>
        )}

        {numeros.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            Nenhum número Vapi cadastrado. Clique &quot;Adicionar&quot;.
          </div>
        ) : (
          <div className="space-y-2">
            {numeros.map((n) => (
              <div key={n.id} className="flex items-center gap-3 border border-border rounded p-3">
                <div className="text-2xl">{FLAGS[n.country_code] || "🌍"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{n.nome}</span>
                    {n.is_default && (
                      <Badge variant="secondary" className="text-[9px]">
                        <Star className="h-2 w-2 mr-1" /> Default
                      </Badge>
                    )}
                    <Badge variant={n.is_active ? "success" : "destructive"} className="text-[9px]">
                      {n.is_active ? "ativo" : "inativo"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{n.telefone}</div>
                  {n.observacoes && <div className="text-[10px] text-muted-foreground mt-1">{n.observacoes}</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleDefault(n.id, n.is_default)} title="Definir como default">
                    <Star className={`h-3 w-3 ${n.is_default ? "fill-yellow-400 text-yellow-400" : ""}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleAtivo(n.id, n.is_active)}>
                    {n.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remover(n.id)}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground border-t border-border pt-3">
          💡 <b>Como funciona a seleção automática:</b> Quando você dispara ligações,
          o sistema detecta o país pelo prefixo do telefone (ex: +55 = BR, +1 = US) e usa o número Vapi correspondente.
          Se não encontrar, usa o Default. Se não tiver Default, usa o <code>VAPI_PHONE_NUMBER_ID</code> do .env como fallback.
        </div>
      </CardContent>
    </Card>
  );
}
