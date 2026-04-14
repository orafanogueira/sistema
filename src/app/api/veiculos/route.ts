import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  const status = url.searchParams.get("status") || "disponivel";
  const q = supabase.from("veiculos").select("*").eq("status", status).order("updated_at", { ascending: false });
  const { data, error } = cliente_id ? await q.eq("cliente_id", cliente_id) : await q;
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  const body = await req.json();
  const { data, error } = await supabase.from("veiculos").insert({
    tenant_id: m?.tenant_id, ...body,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
