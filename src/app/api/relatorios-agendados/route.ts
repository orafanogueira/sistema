import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("relatorios_agendados").select("*,cliente:clientes(nome)").order("created_at", { ascending: false });
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

  // proxima execucao: proximo dia X do mes
  const hoje = new Date();
  const dia_do_mes = Math.min(body.dia_do_mes || 1, 28);
  const next = new Date(hoje.getFullYear(), hoje.getMonth(), dia_do_mes);
  if (next <= hoje) next.setMonth(next.getMonth() + 1);

  const { data, error } = await supabase.from("relatorios_agendados").insert({
    tenant_id: m.tenant_id,
    cliente_id: body.cliente_id,
    tipo: body.tipo || "mensal",
    formato: body.formato || "whatsapp_text",
    dia_do_mes,
    channels: body.channels || ["whatsapp"],
    destinatarios: body.destinatarios || [],
    include_social: body.include_social ?? true,
    include_trafego: body.include_trafego ?? true,
    include_crm: body.include_crm ?? true,
    include_financeiro: body.include_financeiro ?? false,
    next_send_at: next.toISOString(),
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
