import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { name, trigger, trigger_config, conditions, actions, cliente_id, pipeline_id, is_active } = await req.json();
  if (!name || !trigger) return new NextResponse("name e trigger obrigatorios", { status: 400 });

  const { data, error } = await supabase.from("automations").insert({
    tenant_id: m.tenant_id,
    cliente_id: cliente_id || null,
    pipeline_id: pipeline_id || null,
    name,
    trigger,
    trigger_config: trigger_config || {},
    conditions: conditions || [],
    actions: actions || [],
    is_active: is_active ?? true,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { id, ...patch } = await req.json();
  if (!id) return new NextResponse("id obrigatorio", { status: 400 });
  const { error } = await supabase.from("automations").update(patch).eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatorio", { status: 400 });
  const { error } = await supabase.from("automations").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}
