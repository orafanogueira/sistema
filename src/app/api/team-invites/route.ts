import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ZAPIClient } from "@/lib/integrations/zapi";

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
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { email, role, team, phone } = body;

  // Remove convite anterior se existir
  await supabase.from("team_invites").delete().eq("tenant_id", m.tenant_id).eq("email", email);

  const { data, error } = await supabase.from("team_invites").insert({
    tenant_id: m.tenant_id, email, role: role || "readonly", team, invited_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/convite/${data.token}`;

  // Envia via WhatsApp se tiver phone
  if (phone) {
    try {
      const zapi = new ZAPIClient();
      await zapi.sendText(phone,
        `Voce foi convidado pro Grupo Nogueira OS! 🚀\n\nClique aqui pra aceitar o convite:\n${inviteUrl}\n\nExpira em 14 dias.`);
    } catch (e) { console.error("zapi erro:", e); }
  }

  return NextResponse.json({ ...data, invite_url: inviteUrl });
}
