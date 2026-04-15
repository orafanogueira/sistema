import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { lead_id, tipo, resultado, duracao_seg, notas, proximo_passo, proximo_contato_at, novo_status } = await req.json();
  if (!lead_id || !tipo) return new NextResponse("lead_id e tipo obrigatorios", { status: 400 });

  const { data, error } = await supabase.from("prospeccao_atividades").insert({
    tenant_id: m.tenant_id,
    lead_id,
    user_id: user.id,
    tipo,
    resultado: resultado || null,
    duracao_seg: duracao_seg ? Number(duracao_seg) : null,
    notas: notas || null,
    proximo_passo: proximo_passo || null,
    proximo_contato_at: proximo_contato_at || null,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  // atualiza lead
  const leadPatch: Record<string, string | null | undefined> = {
    updated_at: new Date().toISOString(),
    assigned_to: user.id,
    proximo_contato_at: proximo_contato_at || null,
  };
  if (novo_status) leadPatch.status = novo_status;
  if (notas) leadPatch.notas = notas;
  await supabase.from("prospeccao_leads").update(leadPatch).eq("id", lead_id);

  return NextResponse.json(data);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const lead_id = url.searchParams.get("lead_id");
  let q = supabase.from("prospeccao_atividades")
    .select("*,user:profiles(full_name,email)")
    .order("created_at", { ascending: false });
  if (lead_id) q = q.eq("lead_id", lead_id);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
