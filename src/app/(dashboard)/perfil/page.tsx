import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerfilForm } from "@/components/perfil/perfil-form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
  const { data: membership } = await supabase
    .from("memberships").select("*,tenant:tenants(name,slug,plan)").eq("user_id", user!.id).maybeSingle();

  const tenant = membership?.tenant as { name?: string; slug?: string; plan?: string } | null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Meu perfil</h1>
        <p className="text-muted-foreground">Dados pessoais e preferencias.</p>
      </div>

      <PerfilForm profile={profile} />

      <Card>
        <CardHeader><CardTitle className="text-sm">Agencia / Tenant</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Nome:</span> <b>{tenant?.name}</b></div>
          <div><span className="text-muted-foreground">Slug:</span> <code className="text-xs">{tenant?.slug}</code></div>
          <div><span className="text-muted-foreground">Plano:</span> {tenant?.plan || "starter"}</div>
          <div><span className="text-muted-foreground">Seu papel:</span> {membership?.role}</div>
          <div><span className="text-muted-foreground">Time:</span> {membership?.team || "admin"}</div>
        </CardContent>
      </Card>
    </div>
  );
}
