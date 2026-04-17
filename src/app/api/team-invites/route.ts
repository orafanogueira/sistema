import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, conviteEmailHtml } from "@/lib/email/resend";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_invites").select("*").is("accepted_at", null).order("created_at", { ascending: false });
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships")
    .select("tenant_id,tenant:tenants(name)")
    .eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const body = await req.json();
  const { email, role, team } = body;
  if (!email?.trim()) return new NextResponse("email obrigatorio", { status: 400 });

  // Remove convite anterior se existir
  await supabase.from("team_invites").delete().eq("tenant_id", m.tenant_id).eq("email", email);

  const { data, error } = await supabase.from("team_invites").insert({
    tenant_id: m.tenant_id, email, role: role || "readonly", team: team || null, invited_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.gruponogueiramkt.com";
  const inviteUrl = `${baseUrl}/convite/${data.token}`;
  const tenantName = (m.tenant as { name?: string } | null)?.name || "Nogueira OS";

  // Envia email de convite
  const emailSent = await sendEmail({
    to: email,
    subject: `Convite pra ${tenantName} — Nogueira OS`,
    html: conviteEmailHtml({
      nomeConvidado: email,
      tenantName,
      role: role || "readonly",
      team: team || undefined,
      inviteUrl,
      convidadoPor: profile?.full_name || user.email || undefined,
    }),
  });

  return NextResponse.json({
    ...data,
    invite_url: inviteUrl,
    email_sent: emailSent,
    message: emailSent ? "Convite enviado por email" : "Convite criado (email nao configurado — copie o link)",
  });
}
