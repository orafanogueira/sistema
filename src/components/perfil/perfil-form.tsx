"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export function PerfilForm({ profile }: { profile: Profile | null }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update(form).eq("id", profile!.id);
      if (error) throw error;
      toast.success("Perfil atualizado", "Suas informacoes foram salvas");
    } catch (e: unknown) {
      toast.error("Erro ao salvar", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Dados pessoais</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Nome completo</Label><Input className="mt-1" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Email</Label><Input className="mt-1" value={profile?.email} disabled /></div>
          <div><Label>Telefone / WhatsApp</Label><Input className="mt-1" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+5511999999999" /></div>

          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
