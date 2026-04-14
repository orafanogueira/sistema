import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { name, cliente_id, vertical, stages, is_default } = await req.json();

  const { data: pipe, error } = await supabase.from("pipelines").insert({
    tenant_id: m.tenant_id, cliente_id: cliente_id || null,
    name, vertical: vertical || "generico", is_default: is_default ?? false,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  if (Array.isArray(stages)) {
    await supabase.from("pipeline_stages").insert(stages.map((s, i) => ({
      pipeline_id: pipe.id, name: s.name, color: s.color || "#64748b",
      position: s.position ?? i, is_won: s.is_won || false, is_lost: s.is_lost || false,
      sla_minutes: s.sla_minutes || null,
    })));
  }

  return NextResponse.json(pipe);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  const q = supabase.from("pipelines").select("*,stages:pipeline_stages(*)").order("created_at");
  const { data, error } = cliente_id ? await q.eq("cliente_id", cliente_id) : await q;
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
