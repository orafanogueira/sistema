"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Power, Loader2, Trash2, Pencil } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";

export function AutomacaoActions({ id, isActive }: { id: string; isActive: boolean }) {
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(isActive);

  const toggle = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !active }),
      });
      if (!r.ok) throw new Error(await r.text());
      setActive(!active);
      toast.success(!active ? "Automacao ativada" : "Automacao pausada");
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm("Excluir essa automacao? Nao da pra desfazer.")) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
      toast.success("Automacao excluida");
      setTimeout(() => window.location.reload(), 400);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={toggle} disabled={loading} title={active ? "Pausar" : "Ativar"}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className={`h-4 w-4 ${active ? "text-green-400" : "text-muted-foreground"}`} />}
      </Button>
      <Link href={`/automacoes/${id}`}>
        <Button variant="ghost" size="icon" title="Editar"><Pencil className="h-4 w-4" /></Button>
      </Link>
      <Button variant="ghost" size="icon" onClick={remove} disabled={loading} title="Excluir">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
