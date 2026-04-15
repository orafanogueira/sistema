import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { lead_id, titulo, data_reuniao, duracao_min, link_reuniao, notas } = await req.json();
  if (!lead_id || !data_reuniao) return new NextResponse("lead_id e data_reuniao obrigatorios", { status: 400 });

  const { data, error } = await supabase.from("prospeccao_agendamentos").insert({
    tenant_id: m.tenant_id,
    lead_id,
    user_id: user.id,
    titulo: titulo || "Reuniao de prospeccao",
    data_reuniao,
    duracao_min: duracao_min || 30,
    link_reuniao: link_reuniao || null,
    notas: notas || null,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  // avanca lead pra agendado
  await supabase.from("prospeccao_leads").update({
    status: "agendado",
    assigned_to: user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", lead_id);

  // registra atividade
  await supabase.from("prospeccao_atividades").insert({
    tenant_id: m.tenant_id,
    lead_id,
    user_id: user.id,
    tipo: "reuniao",
    resultado: "agendou",
    notas: `Reuniao agendada pra ${new Date(data_reuniao).toLocaleString("pt-BR")}`,
  });

  return NextResponse.json(data);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const upcoming = url.searchParams.get("upcoming") === "true";
  let q = supabase.from("prospeccao_agendamentos")
    .select("*,lead:prospeccao_leads(nome,telefone),user:profiles(full_name,email)")
    .order("data_reuniao", { ascending: true });
  if (upcoming) q = q.gte("data_reuniao", new Date().toISOString()).eq("status", "agendado");
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
