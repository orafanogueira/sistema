import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { AceitarConvite } from "./client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // usa service client direto (sem cookies) pra ler convite publicamente
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return notFound();

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await supabase.from("team_invites")
    .select("*,tenant:tenants(name)")
    .eq("token", token).is("accepted_at", null).maybeSingle();

  if (!data) return notFound();
  if (data.expires_at && new Date(data.expires_at) < new Date()) return notFound();

  const tenant = data.tenant as { name?: string } | null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,rgba(0,85,204,.15),transparent_60%)]">
      <Card className="w-full max-w-md p-8">
        <CardContent className="p-0 text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan mx-auto mb-6" />
          <div className="text-xs uppercase tracking-wider text-cyan font-bold mb-2">Convite recebido</div>
          <h1 className="text-2xl font-black mb-2">Voce foi convidado pra {tenant?.name || "Nogueira OS"}</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Convite pra <b>{data.email}</b> com papel <b>{data.role}</b>
            {data.team && ` no time de ${data.team}`}.
          </p>
          <AceitarConvite token={token} email={data.email} />
        </CardContent>
      </Card>
    </div>
  );
}
