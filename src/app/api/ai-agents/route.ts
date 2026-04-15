import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { name, persona, system_prompt, model, channels, cliente_id, is_active } = await req.json();
  if (!name) return new NextResponse("name obrigatorio", { status: 400 });

  const { data, error } = await supabase.from("ai_agents").insert({
    tenant_id: m.tenant_id,
    cliente_id: cliente_id || null,
    name,
    persona: persona || "",
    system_prompt: system_prompt || persona || "Voce e um atendente profissional e educado.",
    model: model || "claude-sonnet-4-5",
    channels: channels || ["whatsapp"],
    is_active: is_active ?? true,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { id, ...patch } = await req.json();
  if (!id) return new NextResponse("id obrigatorio", { status: 400 });
  const { error } = await supabase.from("ai_agents").update(patch).eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatorio", { status: 400 });
  const { error } = await supabase.from("ai_agents").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}
