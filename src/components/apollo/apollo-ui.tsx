"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Mail, MessageSquare, Linkedin, Users, Building2, Download } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ModalDisparo } from "@/components/extratores/modal-disparo";

interface ApolloContato {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  phone_numbers?: Array<{ raw_number: string }>;
  organization_name?: string;
  city?: string;
  state?: string;
}

const CARGOS_SUGERIDOS = [
  "Dono de loja de carros",
  "CEO",
  "Gerente de Marketing",
  "Diretor Comercial",
  "Proprietário",
  "Fundador",
  "Gestor de Tráfego",
  "Head of Sales",
  "Gerente",
];

const INDUSTRIAS_SUGERIDAS = [
  "automotive",
  "marketing",
  "real estate",
  "retail",
  "health",
  "e-learning",
];

export function ApolloUI() {
  const [busca, setBusca] = useState({
    job_titles: "",
    location: "Brazil",
    company_name: "",
    industry: "",
    per_page: 25,
  });
  const [loading, setLoading] = useState(false);
  const [contatos, setContatos] = useState<ApolloContato[]>([]);
  const [total, setTotal] = useState(0);
  const [modalDisparo, setModalDisparo] = useState<{
    aberto: boolean;
    tipo: "whatsapp" | "email";
    contatos: Array<Record<string, unknown>>;
  }>({ aberto: false, tipo: "email", contatos: [] });

  const buscar = async () => {
    if (!busca.job_titles && !busca.company_name) {
      return toast.error("Informe cargo ou empresa");
    }
    setLoading(true);
    setContatos([]);
    try {
      const r = await fetch("/api/extratores/apollo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "pessoas",
          job_titles: busca.job_titles.split(",").map((x) => x.trim()).filter(Boolean),
          location: busca.location,
          company_name: busca.company_name,
          industry: busca.industry || undefined,
          per_page: busca.per_page,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setContatos(data.contacts || []);
      setTotal(data.total || 0);
      const comEmail = (data.contacts || []).filter((c: ApolloContato) => c.email).length;
      toast.success(`${data.contacts?.length || 0} contatos`, `${comEmail} com email · ${data.total} disponíveis`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  const abrirDisparo = (tipo: "whatsapp" | "email") => {
    const formatados = contatos.map((c) => ({
      nome: c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      email: c.email,
      phone: c.phone_numbers?.[0]?.raw_number,
      telefone: c.phone_numbers?.[0]?.raw_number,
      businessCategory: c.title,
      biography: `${c.title || ""} ${c.organization_name ? `na ${c.organization_name}` : ""}`.trim(),
    }));
    setModalDisparo({ aberto: true, tipo, contatos: formatados });
  };

  const downloadCSV = () => {
    if (contatos.length === 0) return;
    const headers = ["Nome", "Cargo", "Empresa", "Email", "LinkedIn", "Cidade", "Estado"];
    const rows = contatos.map((c) => [
      c.name || "",
      c.title || "",
      c.organization_name || "",
      c.email || "",
      c.linkedin_url || "",
      c.city || "",
      c.state || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apollo-${busca.job_titles || busca.company_name}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const comEmail = contatos.filter((c) => c.email).length;
  const comPhone = contatos.filter((c) => c.phone_numbers?.[0]?.raw_number).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Linkedin className="h-4 w-4 text-[#0A66C2]" /> Apollo LinkedIn — buscar decisores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cargos (separe por vírgula)</Label>
              <Input
                className="mt-1"
                placeholder="CEO, Dono de loja de carros, Diretor comercial"
                value={busca.job_titles}
                onChange={(e) => setBusca({ ...busca, job_titles: e.target.value })}
              />
            </div>
            <div>
              <Label>Localização</Label>
              <Input
                className="mt-1"
                placeholder="São Paulo, Brazil"
                value={busca.location}
                onChange={(e) => setBusca({ ...busca, location: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Empresa (opcional)</Label>
              <Input
                className="mt-1"
                placeholder="Ex: Localiza, Movida..."
                value={busca.company_name}
                onChange={(e) => setBusca({ ...busca, company_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Máx resultados</Label>
              <Input
                type="number"
                className="mt-1"
                min={10}
                max={100}
                value={busca.per_page}
                onChange={(e) => setBusca({ ...busca, per_page: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Cargos sugeridos</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {CARGOS_SUGERIDOS.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant="outline"
                  className="text-[10px] h-7"
                  onClick={() => {
                    const atual = busca.job_titles.split(",").map((x) => x.trim()).filter(Boolean);
                    if (!atual.includes(c)) {
                      setBusca({ ...busca, job_titles: [...atual, c].join(", ") });
                    }
                  }}
                >
                  + {c}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={buscar} disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Buscando no Apollo...</>
            ) : (
              <><Search className="h-4 w-4" /> Buscar contatos</>
            )}
          </Button>

          <div className="text-[10px] text-muted-foreground">
            Apollo.io tem banco global de +275M de profissionais do LinkedIn com email e telefone.
            Plano grátis: 50 créditos/mês (1 crédito = 1 email revelado). Configure <code>APOLLO_API_KEY</code> no Vercel.
          </div>
        </CardContent>
      </Card>

      {contatos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm">
                  {contatos.length} contatos encontrados
                  {total > contatos.length && (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      (de {total.toLocaleString()} disponíveis)
                    </span>
                  )}
                </CardTitle>
                <div className="flex gap-2 mt-2 text-[11px]">
                  <Badge variant="success">📧 {comEmail} com email</Badge>
                  {comPhone > 0 && <Badge variant="secondary">📱 {comPhone} com telefone</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadCSV}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
                <Button size="sm" onClick={() => abrirDisparo("email")} disabled={comEmail === 0}>
                  <Mail className="h-3 w-3" /> Disparar Email IA
                </Button>
                {comPhone > 0 && (
                  <Button size="sm" variant="outline" onClick={() => abrirDisparo("whatsapp")}>
                    <MessageSquare className="h-3 w-3" /> Disparar WhatsApp IA
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Cargo</th>
                    <th className="p-2 text-left">Empresa</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Local</th>
                    <th className="p-2 text-left">LinkedIn</th>
                  </tr>
                </thead>
                <tbody>
                  {contatos.slice(0, 200).map((c, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2 font-semibold">{c.name || `${c.first_name} ${c.last_name}`}</td>
                      <td className="p-2">{c.title || "—"}</td>
                      <td className="p-2">
                        {c.organization_name ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {c.organization_name}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-[10px]">
                        {c.email ? <span className="text-green-400">{c.email}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2 text-[10px]">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="p-2">
                        {c.linkedin_url ? (
                          <a href={c.linkedin_url} target="_blank" rel="noopener" className="text-cyan text-[10px] hover:underline">
                            ver
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ModalDisparo
        open={modalDisparo.aberto}
        onClose={() => setModalDisparo({ ...modalDisparo, aberto: false })}
        tipo={modalDisparo.tipo}
        contatos={modalDisparo.contatos}
      />
    </div>
  );
}
