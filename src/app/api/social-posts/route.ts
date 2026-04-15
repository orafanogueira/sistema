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
    platforms: body.platforms || [body.platform || "instagram"],
    format: body.format || "feed",
    pillar: body.pillar || "autoridade",
    status: body.status || "rascunho",
    title: body.title,
    briefing: body.briefing,
    copy: body.copy,
    copies_by_platform: body.copies_by_platform || {},
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

  // vincula assets ao post
  if (Array.isArray(body.asset_ids) && body.asset_ids.length > 0) {
    await supabase.from("social_media_assets").update({ post_id: data.id })
      .in("id", body.asset_ids);
  }

  // cria registros de publicacao por plataforma
  if (Array.isArray(body.platforms) && body.platforms.length > 0) {
    const pubs = body.platforms.map((p: string) => ({
      tenant_id: m.tenant_id,
      post_id: data.id,
      platform: p,
      copy_usada: body.copies_by_platform?.[p] || body.copy,
      scheduled_for: body.scheduled_for || null,
      status: "pendente",
    }));
    await supabase.from("social_publicacoes").insert(pubs);
  }

  return NextResponse.json(data);
}
