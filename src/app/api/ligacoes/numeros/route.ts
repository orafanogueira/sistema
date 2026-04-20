import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("vapi_numeros")
    .select("*")
    .order("is_default", { ascending: false })
    .order("country_code");
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { nome, vapi_phone_number_id, telefone, country_code, is_default, observacoes } = body;

  if (!nome || !vapi_phone_number_id || !telefone || !country_code) {
    return new NextResponse("campos obrigatórios: nome, vapi_phone_number_id, telefone, country_code", { status: 400 });
  }

  // se marcou como default, desmarca os outros
  if (is_default) {
    await supabase.from("vapi_numeros").update({ is_default: false }).eq("tenant_id", m.tenant_id);
  }

  const { data, error } = await supabase.from("vapi_numeros").insert({
    tenant_id: m.tenant_id,
    nome,
    vapi_phone_number_id,
    telefone,
    country_code: country_code.toUpperCase(),
    is_default: Boolean(is_default),
    is_active: true,
    observacoes,
  }).select().single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  if (updates.is_default) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
      if (m) {
        await supabase.from("vapi_numeros").update({ is_default: false }).eq("tenant_id", m.tenant_id);
      }
    }
  }

  const { data, error } = await supabase.from("vapi_numeros").update(updates).eq("id", id).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const { error } = await supabase.from("vapi_numeros").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}
