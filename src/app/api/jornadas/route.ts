import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("jornadas").select("*,etapas:jornada_etapas(*,keywords:jornada_keywords(*))").order("created_at");
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

  const { cliente_id, name, is_default, etapas } = await req.json();

  const { data: jornada, error } = await supabase.from("jornadas").insert({
    tenant_id: m.tenant_id, cliente_id, name, is_default: is_default ?? false,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  if (Array.isArray(etapas)) {
    for (let i = 0; i < etapas.length; i++) {
      const e = etapas[i];
      const { data: etapa } = await supabase.from("jornada_etapas").insert({
        jornada_id: jornada.id, name: e.name, position: e.position ?? i,
        color: e.color || "#64748b", is_won: e.is_won || false, is_lost: e.is_lost || false,
        is_sale: e.is_sale || false,
        meta_event: e.meta_event || null,
        meta_custom_event: e.meta_custom_event || null,
        google_conversion_name: e.google_conversion_name || null,
      }).select().single();
      if (etapa && Array.isArray(e.keywords)) {
        await supabase.from("jornada_keywords").insert(e.keywords.map((kw: { pattern: string; is_regex?: boolean; case_sensitive?: boolean; direction?: string }) => ({
          etapa_id: etapa.id,
          pattern: kw.pattern, is_regex: kw.is_regex || false,
          case_sensitive: kw.case_sensitive || false, direction: kw.direction || "any",
        })));
      }
    }
  }

  return NextResponse.json(jornada);
}
