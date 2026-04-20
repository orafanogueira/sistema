"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function ReprocessarLigacao({ ligacaoId }: { ligacaoId: string }) {
  const [loading, setLoading] = useState(false);

  const reprocessar = async () => {
    if (!confirm("Reprocessar fluxo pós-ligação? Vai disparar WhatsApp pro lead + notificar você (se ainda não mandou).")) return;
    setLoading(true);
    try {
      const r = await fetch("/api/ligacoes/reprocessar-pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligacao_id: ligacaoId }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success("Reprocessado", `WhatsApp: ${data.enviou_whatsapp ? "✅" : "❌"} · Rafa: ${data.notificou_rafa ? "✅" : "❌"}`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={reprocessar} disabled={loading}>
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Reprocessando...</>
      ) : (
        <><RefreshCw className="h-3 w-3" /> Disparar fluxo pós</>
      )}
    </Button>
  );
}
