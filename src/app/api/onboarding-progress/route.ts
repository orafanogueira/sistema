import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { data } = await supabase.from("onboarding_progress").select("*").eq("tenant_id", m.tenant_id).maybeSingle();

  // auto-detect completions
  if (data && !data.completed) {
    const updates: Record<string, boolean> = {};
    const { count: clientesCount } = await supabase.from("clientes").select("*", { count: "exact", head: true });
    if ((clientesCount || 0) > 0 && !data.step_import_clients) updates.step_import_clients = true;

    const { count: metaCount } = await supabase.from("integrations")
      .select("*", { count: "exact", head: true }).eq("provider", "meta_ads").eq("is_connected", true);
    if ((metaCount || 0) > 0 && !data.step_connect_meta) updates.step_connect_meta = true;

    const { count: agentsCount } = await supabase.from("ai_agents").select("*", { count: "exact", head: true }).eq("is_active", true);
    if ((agentsCount || 0) > 0 && !data.step_create_agent_ia) updates.step_create_agent_ia = true;

    const { count: cobCount } = await supabase.from("cobrancas").select("*", { count: "exact", head: true });
    if ((cobCount || 0) > 0 && !data.step_create_first_charge) updates.step_create_first_charge = true;

    const { count: membersCount } = await supabase.from("memberships").select("*", { count: "exact", head: true });
    const { count: pendingInvitesCount } = await supabase.from("team_invites").select("*", { count: "exact", head: true }).eq("tenant_id", m.tenant_id);
    if (((membersCount || 0) > 1 || (pendingInvitesCount || 0) > 0) && !data.step_invite_team) updates.step_invite_team = true;

    const { count: webhooksCount } = await supabase.from("integrations")
      .select("*", { count: "exact", head: true }).eq("provider", "meta_ads").not("webhook_verified_at", "is", null);
    if ((webhooksCount || 0) > 0 && !data.step_configure_webhooks) updates.step_configure_webhooks = true;

    if (Object.keys(updates).length > 0) {
      const merged = { ...data, ...updates };
      const all = [merged.step_import_clients, merged.step_connect_meta, merged.step_create_agent_ia,
                   merged.step_create_first_charge, merged.step_invite_team, merged.step_configure_webhooks];
      if (all.filter(Boolean).length >= 6) {
        updates.completed = true as unknown as boolean;
      }
      await supabase.from("onboarding_progress").update(updates).eq("tenant_id", m.tenant_id);
      return NextResponse.json({ ...data, ...updates });
    }
  }

  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { data, error } = await supabase.from("onboarding_progress").update(body).eq("tenant_id", m.tenant_id).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
