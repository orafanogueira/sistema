"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AceitarConvite({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const aceitar = async () => {
    setLoading(true); setErr(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/signup?email=${encodeURIComponent(email)}&invite=${token}`);
        return;
      }

      const r = await fetch(`/api/team-invites/${token}`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      setOk(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  if (ok) {
    return (
      <div className="flex flex-col items-center gap-2 text-green-400">
        <CheckCircle2 className="h-12 w-12" />
        <div className="font-bold">Convite aceito!</div>
        <div className="text-sm text-muted-foreground">Redirecionando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={aceitar} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar convite"}
      </Button>
      {err && <div className="text-sm text-red-400">{err}</div>}
      <div className="text-xs text-muted-foreground">
        Se ainda nao tem conta, vai abrir tela de signup com email pre-preenchido.
      </div>
    </div>
  );
}
