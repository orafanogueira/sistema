import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function randSlug(n = 6) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("short_links").select("*,cliente:clientes(nome)").order("created_at", { ascending: false });
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
  const slug = body.slug?.trim() || randSlug(6);
  const { data, error } = await supabase.from("short_links").insert({
    tenant_id: m.tenant_id,
    cliente_id: body.cliente_id,
    slug,
    name: body.name,
    destination_url: body.destination_url,
    default_message: body.default_message,
    utm: body.utm || {},
    campaign_ref: body.campaign_ref,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
