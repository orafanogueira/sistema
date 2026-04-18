"use client";
import { useState } from "react";
import { toast } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";

export function ToggleFinanceiro({ membershipId, currentValue }: { membershipId: string; currentValue: boolean }) {
  const [enabled, setEnabled] = useState(currentValue);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("memberships")
        .update({ can_see_financeiro: !enabled })
        .eq("id", membershipId);
      if (error) throw error;
      setEnabled(!enabled);
      toast.success(!enabled ? "Financeiro liberado" : "Financeiro bloqueado");
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  return (
    <button onClick={toggle} disabled={loading}
      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${enabled ? "bg-green-500/20 border-green-500/30 text-green-400" : "bg-secondary border-border text-muted-foreground"}`}
      title={enabled ? "Clique pra bloquear acesso financeiro" : "Clique pra liberar acesso financeiro"}>
      {enabled ? "💰 Financeiro ✓" : "💰 Financeiro ✕"}
    </button>
  );
}
