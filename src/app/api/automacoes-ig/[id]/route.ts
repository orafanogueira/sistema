import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: auto }, { data: runs }] = await Promise.all([
    supabase.from("ig_automacoes").select("*,ig_account:instagram_accounts(ig_username,ig_user_id),cliente:clientes(nome)").eq("id", id).maybeSingle(),
    supabase.from("ig_automacao_runs").select("*").eq("automacao_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!auto) return new NextResponse("nao encontrado", { status: 404 });
  return NextResponse.json({ automacao: auto, runs: runs || [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from("ig_automacoes").update(body).eq("id", id).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("ig_automacoes").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
