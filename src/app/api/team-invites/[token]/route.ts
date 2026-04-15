import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Aceita convite. GET = info, POST = aceita. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase.from("team_invites")
    .select("*,tenant:tenants(name),invited_by_profile:profiles!team_invites_invited_by_fkey(full_name)")
    .eq("token", token).is("accepted_at", null).maybeSingle();
  if (!data) return new NextResponse("convite invalido", { status: 404 });
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return new NextResponse("convite expirado", { status: 410 });
  }
  return NextResponse.json(data);
}

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("faca login primeiro", { status: 401 });

  const service = createServiceClient();
  const { data: invite } = await service.from("team_invites").select("*").eq("token", token).maybeSingle();
  if (!invite) return new NextResponse("convite nao encontrado", { status: 404 });
  if (invite.accepted_at) return new NextResponse("ja aceito", { status: 400 });

  // Cria membership
  await service.from("profiles").upsert({ id: user.id, email: user.email }, { onConflict: "id" });
  await service.from("memberships").insert({
    tenant_id: invite.tenant_id, user_id: user.id, role: invite.role, team: invite.team,
  });
  await service.from("team_invites").update({ accepted_at: new Date().toISOString() }).eq("token", token);

  return NextResponse.json({ ok: true, tenant_id: invite.tenant_id });
}
