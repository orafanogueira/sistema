import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConvidarMembroButton } from "@/components/configuracoes/convidar-membro";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("memberships").select("tenant:tenants(name,slug,domain,primary_color,is_master,plan)").eq("user_id", user!.id).maybeSingle();
  const tenant = membership?.tenant as { name?: string; slug?: string; domain?: string; primary_color?: string; is_master?: boolean; plan?: string } | null;

  const { data: membros } = await supabase.from("memberships")
    .select("id,role,team,is_active,profile:profiles(full_name,email)")
    .order("created_at");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Configuracoes</h1>
        <p className="text-muted-foreground">Dados da agencia, equipe e white-label.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Agencia</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground">Nome</div><div className="font-bold">{tenant?.name}</div></div>
          <div><div className="text-xs text-muted-foreground">Slug</div><div className="font-mono">{tenant?.slug}</div></div>
          <div><div className="text-xs text-muted-foreground">Plano</div><Badge>{tenant?.plan || "starter"}</Badge></div>
          <div><div className="text-xs text-muted-foreground">Dominio</div><div className="font-mono text-xs">{tenant?.domain || "-"}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Equipe ({(membros || []).length})</CardTitle>
            <ConvidarMembroButton />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
              <tr><th className="p-3 text-left">Nome</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Time</th><th className="p-3 text-left">Status</th></tr>
            </thead>
            <tbody>
              {(membros || []).map((m) => {
                const p = m.profile as { full_name?: string; email?: string } | null;
                return (
                  <tr key={m.id} className="border-b border-border">
                    <td className="p-3 font-semibold">{p?.full_name || "-"}</td>
                    <td className="p-3 font-mono text-xs">{p?.email}</td>
                    <td className="p-3"><Badge variant="outline">{m.role}</Badge></td>
                    <td className="p-3 text-muted-foreground">{m.team || "-"}</td>
                    <td className="p-3"><Badge variant={m.is_active ? "success" : "secondary"}>{m.is_active ? "ativo" : "inativo"}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {tenant?.is_master && (
        <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
          <CardHeader><CardTitle className="text-sm">White-label (revenda)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Voce pode criar tenants para seus clientes com logo, cor e dominio proprios. Cada tenant tem seus proprios usuarios, clientes e dados isolados.</p>
            <Button>Criar tenant de cliente</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
