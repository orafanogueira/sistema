import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: contrato }, { data: eventos }] = await Promise.all([
    supabase.from("contratos").select("*,cliente:clientes(nome,contato_email,contato_whatsapp),signatarios:contrato_signatarios(*)").eq("id", id).maybeSingle(),
    supabase.from("contrato_eventos").select("*").eq("contrato_id", id).order("created_at", { ascending: false }),
  ]);
  if (!contrato) return new NextResponse("nao encontrado", { status: 404 });
  return NextResponse.json({ contrato, eventos: eventos || [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from("contratos").update(body).eq("id", id).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("contratos").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
