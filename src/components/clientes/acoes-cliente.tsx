"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Share2, Calendar, Copy, X, Check, Loader2 } from "lucide-react";

export function AcoesCliente({ clienteId }: { clienteId: string }) {
  const [openDash, setOpenDash] = useState(false);
  const [openRelatorio, setOpenRelatorio] = useState(false);
  const [dashLink, setDashLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [relatorioOk, setRelatorioOk] = useState(false);

  const [dashForm, setDashForm] = useState<{
    name: string; expires_days: number;
    show_meta_ads: boolean; show_leads: boolean; show_social: boolean; show_financeiro: boolean;
  }>({
    name: "Dashboard compartilhado", expires_days: 90,
    show_meta_ads: true, show_leads: true, show_social: true, show_financeiro: false,
  });
  const [relForm, setRelForm] = useState<{
    dia_do_mes: number;
    include_trafego: boolean; include_crm: boolean; include_social: boolean; include_financeiro: boolean;
  }>({
    dia_do_mes: 1,
    include_trafego: true, include_crm: true, include_social: true, include_financeiro: false,
  });

  const gerarDashboard = async () => {
    setLoading(true); setDashLink(null);
    try {
      const r = await fetch("/api/dashboard-publico", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, ...dashForm }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const base = window.location.origin;
      setDashLink(`${base}/dashboard-publico/${data.token}`);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  const agendarRelatorio = async () => {
    setLoading(true); setRelatorioOk(false);
    try {
      const r = await fetch("/api/relatorios-agendados", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, channels: ["whatsapp"], ...relForm }),
      });
      if (!r.ok) throw new Error(await r.text());
      setRelatorioOk(true);
      setTimeout(() => { setOpenRelatorio(false); setRelatorioOk(false); }, 2000);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  const copyLink = () => {
    if (!dashLink) return;
    navigator.clipboard.writeText(dashLink);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpenDash(true)}>
        <Share2 className="h-3 w-3" /> Gerar link publico
      </Button>
      <Button variant="outline" size="sm" onClick={() => setOpenRelatorio(true)}>
        <Calendar className="h-3 w-3" /> Agendar relatorio mensal
      </Button>

      {/* DIALOG DASHBOARD */}
      <Dialog.Root open={openDash} onOpenChange={setOpenDash}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,92vw)] bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Dashboard publico</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={dashForm.name}
                onChange={(e) => setDashForm({ ...dashForm, name: e.target.value })} /></div>
              <div><Label>Expira em (dias)</Label><Input type="number" value={dashForm.expires_days}
                onChange={(e) => setDashForm({ ...dashForm, expires_days: Number(e.target.value) })} /></div>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">O que mostrar:</div>
                {([
                  ["show_meta_ads", "Meta Ads"],
                  ["show_leads", "Leads"],
                  ["show_social", "Social Media"],
                  ["show_financeiro", "Financeiro"],
                ] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={dashForm[k] as boolean}
                      onChange={(e) => setDashForm({ ...dashForm, [k]: e.target.checked } as typeof dashForm)} />
                    {l}
                  </label>
                ))}
              </div>

              {dashLink ? (
                <div className="p-3 bg-cyan/10 border border-cyan/30 rounded space-y-2">
                  <div className="text-xs text-muted-foreground">Link gerado (valido por {dashForm.expires_days} dias):</div>
                  <div className="font-mono text-xs break-all">{dashLink}</div>
                  <Button size="sm" onClick={copyLink} className="w-full">
                    {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar</>}
                  </Button>
                </div>
              ) : (
                <Button onClick={gerarDashboard} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar link"}
                </Button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* DIALOG RELATORIO */}
      <Dialog.Root open={openRelatorio} onOpenChange={setOpenRelatorio}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,92vw)] bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Relatorio mensal automatico</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Todo mes, no dia escolhido, o sistema vai gerar relatorio do mes anterior e enviar via WhatsApp pro cliente.
              </div>
              <div><Label>Dia do mes (1-28)</Label><Input type="number" min="1" max="28" value={relForm.dia_do_mes}
                onChange={(e) => setRelForm({ ...relForm, dia_do_mes: Number(e.target.value) })} /></div>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">Incluir:</div>
                {([
                  ["include_trafego", "Trafego pago"],
                  ["include_crm", "CRM / Leads"],
                  ["include_social", "Social Media"],
                  ["include_financeiro", "Financeiro"],
                ] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={relForm[k] as boolean}
                      onChange={(e) => setRelForm({ ...relForm, [k]: e.target.checked } as typeof relForm)} />
                    {l}
                  </label>
                ))}
              </div>
              {relatorioOk && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm flex items-center gap-2">
                  <Check className="h-4 w-4" /> Agendamento criado!
                </div>
              )}
              <Button onClick={agendarRelatorio} disabled={loading || relatorioOk} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
