import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("whatsapp_numeros")
    .select("*").order("created_at");
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { nome, telefone, zapi_instance_id, zapi_token, max_por_dia, max_por_hora } = await req.json();
  if (!nome || !telefone) return new NextResponse("nome e telefone obrigatórios", { status: 400 });

  const { data, error } = await supabase.from("whatsapp_numeros").insert({
    tenant_id: m.tenant_id, nome, telefone,
    zapi_instance_id: zapi_instance_id || null,
    zapi_token: zapi_token || null,
    max_por_dia: max_por_dia || 100,
    max_por_hora: max_por_hora || 15,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
