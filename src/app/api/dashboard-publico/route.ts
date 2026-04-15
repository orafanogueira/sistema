import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** CRUD de dashboard_public_links (admin). */
export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("dashboard_public_links").select("*,cliente:clientes(nome)").order("created_at", { ascending: false });
  if (cliente_id) q = q.eq("cliente_id", cliente_id);
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
  const expires = body.expires_days ? new Date(Date.now() + Number(body.expires_days) * 86400000).toISOString() : null;

  const { data, error } = await supabase.from("dashboard_public_links").insert({
    tenant_id: m.tenant_id,
    cliente_id: body.cliente_id,
    name: body.name || "Dashboard compartilhado",
    expires_at: expires,
    show_meta_ads: body.show_meta_ads ?? true,
    show_google_ads: body.show_google_ads ?? true,
    show_leads: body.show_leads ?? true,
    show_financeiro: body.show_financeiro ?? false,
    show_social: body.show_social ?? true,
    created_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
