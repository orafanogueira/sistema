"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [agencia, setAgencia] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, agencia_name: agencia } },
    });
    if (error) { setErr(error.message); setLoading(false); return; }
    if (data.user) {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, agencia, email }),
      });
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-500 to-cyan" />
          <div>
            <div className="font-bold">Criar conta</div>
            <div className="text-xs text-muted-foreground">Comece em 1 minuto</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div><Label>Seu nome</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" /></div>
          <div><Label>Nome da agencia</Label><Input value={agencia} onChange={(e) => setAgencia(e.target.value)} required className="mt-1.5" placeholder="Grupo Nogueira" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" /></div>
          <div><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1.5" /></div>

          {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : "Criar conta"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Ja tem conta? <Link href="/login" className="text-cyan font-semibold">Entrar</Link>
        </div>
      </Card>
    </div>
  );
}
