import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Plug, ExternalLink } from "lucide-react";
import { ConectarMetaDialog } from "@/components/integracoes/conectar-meta";

const PROVIDERS = [
  { key: "meta_ads", name: "Meta Ads", desc: "Facebook + Instagram Ads. Campanhas e insights.", color: "from-blue-600 to-blue-400" },
  { key: "google_ads", name: "Google Ads", desc: "Search, Display, YouTube. Campanhas e insights.", color: "from-green-600 to-yellow-400" },
  { key: "ga4", name: "Google Analytics 4", desc: "Usuarios, sessoes, conversoes e origem de trafego.", color: "from-orange-600 to-orange-400" },
  { key: "gtm", name: "Google Tag Manager", desc: "Publicar e ler tags e triggers.", color: "from-blue-500 to-blue-400" },
  { key: "google_calendar", name: "Google Calendar", desc: "Agendamentos e reunioes com clientes.", color: "from-red-500 to-red-400" },
  { key: "gmail", name: "Gmail", desc: "Envio e leitura de emails (follow-up).", color: "from-red-600 to-pink-500" },
  { key: "messenger", name: "Messenger", desc: "DM Facebook via Meta.", color: "from-blue-600 to-cyan-500" },
  { key: "instagram", name: "Instagram Direct", desc: "DM Instagram via Meta.", color: "from-pink-500 to-yellow-400" },
  { key: "whatsapp_cloud", name: "WhatsApp Cloud API", desc: "WhatsApp oficial via Meta.", color: "from-green-500 to-green-400" },
  { key: "zapi", name: "Z-API (WhatsApp)", desc: "WhatsApp via Z-API (ja configurado).", color: "from-emerald-500 to-emerald-400" },
];

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente: clienteId } = await searchParams;
  const supabase = await createClient();

  const query = supabase.from("integrations").select("*");
  const { data: integrations } = clienteId ? await query.eq("cliente_id", clienteId) : await query;

  const connectedByProvider = (integrations || []).reduce((acc, i) => {
    acc[i.provider] = (acc[i.provider] || 0) + (i.is_connected ? 1 : 0);
    return acc;
  }, {} as Record<string, number>);

  const { data: clientes } = await supabase.from("clientes").select("id,nome").order("nome");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Integracoes</h1>
        <p className="text-muted-foreground">Conecte Meta, Google e outras plataformas.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Cliente</CardTitle></CardHeader>
        <CardContent>
          <select className="h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm" defaultValue={clienteId || ""}>
            <option value="">Integracao da agencia (geral)</option>
            {(clientes || []).map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </select>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDERS.map((p) => {
          const connected = (connectedByProvider[p.key] || 0) > 0;
          return (
            <Card key={p.key} className={connected ? "border-green-500/30" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center flex-shrink-0`}>
                    <Plug className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-bold">{p.name}</div>
                      {connected && <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.desc}</div>
                  </div>
                </div>
                {p.key === "meta_ads" ? (
                  <ConectarMetaDialog clienteId={clienteId} />
                ) : p.key === "zapi" ? (
                  <Button variant="outline" className="w-full" disabled>Configurado no .env</Button>
                ) : p.key.startsWith("google") || p.key === "gmail" || p.key === "ga4" || p.key === "gtm" ? (
                  <a href={`/api/integracoes/google-oauth/start${clienteId ? `?cliente=${clienteId}` : ""}`}>
                    <Button variant="outline" className="w-full">{connected ? "Reconectar" : "Conectar com Google"} <ExternalLink className="h-3 w-3" /></Button>
                  </a>
                ) : p.key === "messenger" || p.key === "instagram" || p.key === "whatsapp_cloud" ? (
                  <a href={`/api/integracoes/meta-oauth/start${clienteId ? `?cliente=${clienteId}` : ""}`}>
                    <Button variant="outline" className="w-full">Conectar com Meta <ExternalLink className="h-3 w-3" /></Button>
                  </a>
                ) : (
                  <Button variant="outline" className="w-full">Conectar</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
