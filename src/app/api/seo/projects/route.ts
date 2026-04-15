import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("seo_projects").select("*,cliente:clientes(nome)").order("created_at", { ascending: false });
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
  const { data, error } = await supabase.from("seo_projects").insert({
    tenant_id: m.tenant_id,
    cliente_id: body.cliente_id,
    site_url: body.site_url,
    gmb_place_id: body.gmb_place_id,
    gsc_property: body.gsc_property,
    ga4_property_id: body.ga4_property_id,
    target_keywords: body.target_keywords || [],
    competitors: body.competitors || [],
    tom_de_voz: body.tom_de_voz,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
