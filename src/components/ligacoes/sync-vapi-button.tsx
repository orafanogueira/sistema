"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function SyncVapiButton() {
  const [loading, setLoading] = useState(false);

  const sync = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ligacoes/sync-vapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (data.atualizadas === 0 && data.debug) {
        toast.error(
          `${data.atualizadas} ligações atualizadas`,
          data.mensagem || `Total: ${data.debug.total_ligacoes_7_dias} · Com ID Vapi: ${data.debug.com_vapi_call_id} · Sem ID: ${data.debug.sem_vapi_call_id}`
        );
      } else {
        toast.success(
          `${data.atualizadas} ligações atualizadas`,
          `${data.disparou_fluxo_pos || 0} fluxos pós-ligação disparados`
        );
      }
      setTimeout(() => window.location.reload(), 2500);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={sync} disabled={loading}>
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Sincronizando com Vapi...</>
      ) : (
        <><RefreshCw className="h-3 w-3" /> Sincronizar com Vapi</>
      )}
    </Button>
  );
}
