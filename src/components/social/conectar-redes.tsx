"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plug, X, Loader2, Check, Instagram, Facebook, Linkedin, Music2, Youtube } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const REDES = [
  { provider: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F", fields: ["username", "access_token"] },
  { provider: "facebook", label: "Facebook Page", icon: Facebook, color: "#1877F2", fields: ["page_id", "access_token"] },
  { provider: "linkedin_ads", label: "LinkedIn", icon: Linkedin, color: "#0A66C2", fields: ["company_id", "access_token"] },
  { provider: "tiktok_ads", label: "TikTok", icon: Music2, color: "#000", fields: ["username"] },
  { provider: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000", fields: ["channel_id"] },
];

export function ConectarRedesButton({ clienteId, clienteNome }: { clienteId: string; clienteNome: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, Record<string, string>>>({});
  const [saved, setSaved] = useState<string[]>([]);

  const salvar = async (provider: string) => {
    const values = form[provider] || {};
    setLoading(true);
    try {
      const r = await fetch("/api/social/conectar-rede", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          provider,
          account_id: values.page_id || values.channel_id || values.company_id || values.username || "",
          account_name: values.username || clienteNome,
          access_token: values.access_token || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setSaved([...saved, provider]);
      toast.success(`${provider} conectado pra ${clienteNome}`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const updateField = (provider: string, field: string, value: string) => {
    setForm({ ...form, [provider]: { ...(form[provider] || {}), [field]: value } });
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plug className="h-3 w-3" /> Conectar redes
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,94vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold">Conectar redes — {clienteNome}</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              {REDES.map((r) => {
                const Icon = r.icon;
                const isSaved = saved.includes(r.provider);
                return (
                  <div key={r.provider} className={`border rounded-md p-3 space-y-2 ${isSaved ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: r.color }} />
                      <span className="font-bold text-sm">{r.label}</span>
                      {isSaved && <Check className="h-4 w-4 text-green-400 ml-auto" />}
                    </div>
                    {!isSaved && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {r.fields.map((f) => (
                            <div key={f}>
                              <Label className="text-[10px]">{f === "access_token" ? "Token de acesso" : f === "page_id" ? "Page ID" : f === "channel_id" ? "Channel ID" : f === "company_id" ? "Company ID" : "Username"}</Label>
                              <Input className="mt-0.5 h-8 text-xs" placeholder={f}
                                value={(form[r.provider] || {})[f] || ""}
                                onChange={(e) => updateField(r.provider, f, e.target.value)} />
                            </div>
                          ))}
                        </div>
                        <Button size="sm" onClick={() => salvar(r.provider)} disabled={loading} className="w-full">
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Conectar"}
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}

              <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
                <b>Como pegar os tokens:</b> Instagram/Facebook → Meta Business Suite → Settings → Access Tokens.
                LinkedIn → LinkedIn Developer → App → Auth. YouTube → Google Cloud Console → OAuth.
                Futuro: OAuth automático (quando Meta/LinkedIn aprovarem o app).
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
