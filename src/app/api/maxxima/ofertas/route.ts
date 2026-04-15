import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validarOferta } from "@/lib/maxxima/validador";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("maxxima_ofertas").select("*").order("created_at", { ascending: false });
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

  // Valida automaticamente se tiver sinais
  const validacao = validarOferta({
    anuncios_ativos_dias: body.anuncios_ativos_dias,
    concorrentes_count: body.concorrentes?.length,
    google_trends_score: body.google_trends_score,
    volume_busca: body.volume_busca,
    preco: body.preco,
    nicho: body.nicho,
  });

  const { data, error } = await supabase.from("maxxima_ofertas").insert({
    tenant_id: m.tenant_id,
    ...body,
    score_viabilidade: validacao.score,
    validado: validacao.veredito === "validar",
    viabilidade_notes: JSON.stringify(validacao),
    status: validacao.veredito === "validar" ? "pronto_producao" : "validando",
  }).select().single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ...data, validacao });
}
