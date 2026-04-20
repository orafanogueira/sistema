import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("nichos_campanha")
    .select("*")
    .eq("is_ativo", true)
    .order("is_default", { ascending: false })
    .order("nome");
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { slug, nome, setor_descricao, prova_social, metrica_volume, pergunta_qualifica_volume, metrica_resultado, exemplo_resultado, publico } = body;

  if (!slug || !nome || !setor_descricao || !prova_social || !pergunta_qualifica_volume) {
    return new NextResponse("campos obrigatórios: slug, nome, setor_descricao, prova_social, pergunta_qualifica_volume", { status: 400 });
  }

  const { data, error } = await supabase.from("nichos_campanha").insert({
    tenant_id: m.tenant_id,
    slug, nome, setor_descricao, prova_social,
    metrica_volume: metrica_volume || "clientes por mês",
    pergunta_qualifica_volume,
    metrica_resultado: metrica_resultado || "resultado",
    exemplo_resultado,
    publico: publico || "donos de negócio",
  }).select().single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const { data, error } = await supabase.from("nichos_campanha").update(updates).eq("id", id).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatório", { status: 400 });

  const { error } = await supabase.from("nichos_campanha").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}
