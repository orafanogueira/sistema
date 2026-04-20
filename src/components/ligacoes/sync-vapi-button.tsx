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
      const r = await fetch("/api/ligacoes/sync-vapi", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(
        `${data.atualizadas} ligações atualizadas`,
        `${data.disparou_fluxo_pos || 0} fluxos pós-ligação disparados`
      );
      setTimeout(() => window.location.reload(), 1500);
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
