"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Check } from "lucide-react";

export function EnviarWhatsAppButton({ cobrancaId }: { cobrancaId: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const enviar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/cobrancas/${cobrancaId}/enviar-wa`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  return (
    <Button size="sm" variant="ghost" onClick={enviar} disabled={loading || sent}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : sent ? <Check className="h-3 w-3 text-green-400" /> : <Send className="h-3 w-3" />}
      {sent ? "Enviado" : "WhatsApp"}
    </Button>
  );
}
