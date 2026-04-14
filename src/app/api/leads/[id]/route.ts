import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: lead }, { data: activities }, { data: financ }] = await Promise.all([
    supabase.from("leads").select("*,vendedor:vendedores(nome,whatsapp),stage:pipeline_stages(name,color),veiculo:veiculos(*)").eq("id", id).maybeSingle(),
    supabase.from("lead_activities").select("*,vendedor:vendedores(nome)").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("financiamentos").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);
  if (!lead) return new NextResponse("nao encontrado", { status: 404 });
  return NextResponse.json({ lead, activities: activities || [], financiamentos: financ || [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from("leads").update({ ...body, ultima_atividade_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
