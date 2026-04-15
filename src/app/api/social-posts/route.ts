import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  const status = url.searchParams.get("status");
  let q = supabase.from("social_posts")
    .select("*,cliente:clientes(nome)")
    .order("created_at", { ascending: false }).limit(100);
  if (cliente_id) q = q.eq("cliente_id", cliente_id);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
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
  const { data, error } = await supabase.from("social_posts").insert({
    tenant_id: m.tenant_id,
    cliente_id: body.cliente_id,
    platform: body.platform || "instagram",
    format: body.format || "feed",
    pillar: body.pillar || "autoridade",
    status: body.status || "rascunho",
    title: body.title,
    briefing: body.briefing,
    copy: body.copy,
    hook: body.hook,
    cta: body.cta,
    hashtags: body.hashtags || [],
    carrossel_slides: body.carrossel_slides || [],
    roteiro: body.roteiro,
    design_brief: body.design_brief,
    midia_urls: body.midia_urls || [],
    scheduled_for: body.scheduled_for,
    generated_by_agent: body.generated_by_agent || null,
    created_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
