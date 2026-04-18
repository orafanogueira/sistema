"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loader2, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AceitarConvite({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [mode, setMode] = useState<"inicial" | "signup" | "login">("inicial");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  const aceitarConvite = async () => {
    const r = await fetch(`/api/team-invites/${token}`, { method: "POST" });
    if (!r.ok) throw new Error(await r.text());
    setOk(true);
    setTimeout(() => router.push("/social"), 1500);
  };

  const tentarAceitar = async () => {
    setLoading(true); setErr(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await aceitarConvite();
      } else {
        setMode("signup");
      }
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  const criarConta = async () => {
    if (!password || password.length < 6) return setErr("Senha precisa ter no mínimo 6 caracteres");
    setLoading(true); setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: nome || email.split("@")[0] } },
      });
      if (error) throw error;
      // aguarda confirmar email (Supabase pode exigir)
      // tenta aceitar direto
      await aceitarConvite();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        setErr("Email já tem conta — use login");
        setMode("login");
      } else {
        setErr(msg);
      }
    } finally { setLoading(false); }
  };

  const fazerLogin = async () => {
    if (!password) return setErr("Informe a senha");
    setLoading(true); setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await aceitarConvite();
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

  if (mode === "inicial") {
    return (
      <div className="space-y-3">
        <Button className="w-full" onClick={tentarAceitar} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar convite"}
        </Button>
        {err && <div className="text-sm text-red-400">{err}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-border pb-2">
        <button onClick={() => { setMode("signup"); setErr(null); }}
          className={`text-sm font-semibold pb-1 border-b-2 ${mode === "signup" ? "border-cyan text-cyan" : "border-transparent text-muted-foreground"}`}>
          <UserPlus className="h-3 w-3 inline mr-1" /> Criar conta
        </button>
        <button onClick={() => { setMode("login"); setErr(null); }}
          className={`text-sm font-semibold pb-1 border-b-2 ${mode === "login" ? "border-cyan text-cyan" : "border-transparent text-muted-foreground"}`}>
          <LogIn className="h-3 w-3 inline mr-1" /> Já tenho conta
        </button>
      </div>

      <div>
        <Label>Email</Label>
        <Input className="mt-1" value={email} disabled />
      </div>

      {mode === "signup" && (
        <div>
          <Label>Seu nome</Label>
          <Input className="mt-1" placeholder="Nome completo" value={nome}
            onChange={(e) => setNome(e.target.value)} />
        </div>
      )}

      <div>
        <Label>{mode === "signup" ? "Crie uma senha" : "Senha"}</Label>
        <Input className="mt-1" type="password" placeholder="Mínimo 6 caracteres"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <Button className="w-full" onClick={mode === "signup" ? criarConta : fazerLogin} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
          mode === "signup" ? <><UserPlus className="h-4 w-4" /> Criar conta e aceitar</> :
          <><LogIn className="h-4 w-4" /> Entrar e aceitar</>}
      </Button>

      {err && <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded">{err}</div>}
    </div>
  );
}
