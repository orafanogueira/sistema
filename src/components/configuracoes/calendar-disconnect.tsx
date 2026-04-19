"use client";
import { Button } from "@/components/ui/button";
import { Unplug } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { useState } from "react";

export function CalendarDisconnectButton() {
  const [loading, setLoading] = useState(false);

  const desconectar = async () => {
    if (!confirm("Desconectar Google Calendar? A IA vai parar de agendar automaticamente.")) return;
    setLoading(true);
    try {
      const r = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Desconectado");
      window.location.reload();
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={desconectar} disabled={loading}>
      <Unplug className="h-3 w-3" /> Desconectar
    </Button>
  );
}
