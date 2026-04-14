"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

export function EnviarAssinaturaButton({ contratoId }: { contratoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const enviar = async () => {
    if (!confirm("Confirmar envio? Sera gerado PDF e enviado por email aos signatarios via Clicksign.")) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/contratos/${contratoId}/enviar`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  return (
    <Button onClick={enviar} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      Enviar pra assinatura
    </Button>
  );
}
