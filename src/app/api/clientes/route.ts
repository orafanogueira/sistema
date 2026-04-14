import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data: membership } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  if (!membership) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { data, error } = await supabase.from("clientes").insert({
    tenant_id: membership.tenant_id,
    slug: body.slug,
    nome: body.nome,
    segmento: body.segmento || null,
    contato_nome: body.contato_nome || null,
    contato_email: body.contato_email || null,
    contato_whatsapp: body.contato_whatsapp || null,
    ticket_mensal: body.ticket_mensal || 0,
    vencimento: body.vencimento || null,
    status: body.status || "ativo",
    observacoes: body.observacoes || null,
    data_inicio: body.data_inicio || new Date().toISOString().slice(0, 10),
  }).select().single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
