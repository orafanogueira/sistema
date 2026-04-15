import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/ai-agents/runner";
import { renderCarrosselSVG } from "@/lib/criativos/carrossel-svg";

/**
 * Endpoint all-in-one: gera carrossel via agente IA + renderiza slides em SVG.
 * Body: { cliente_id, tema, objetivo, slides (num), publico, cor_primaria, cor_secundaria, marca }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { cliente_id, tema, objetivo, slides, publico, cor_primaria, cor_secundaria, marca } = body;

  // Gera JSON do carrossel via agente
  const res = await runAgent(supabase, m.tenant_id, cliente_id || null, user.id, {
    agent_key: "social_carrossel",
    input: { tema, objetivo: objetivo || "educacional", slides: slides || 7, publico },
    cliente_context: cliente_id ? { nome: body.cliente_nome } : undefined,
  });

  const parsed = res.output_data as { slides?: { ordem: number; tipo?: string; titulo: string; texto?: string; elemento_visual?: string }[]; titulo_capa?: string; subtitulo_capa?: string } | null;
  if (!parsed?.slides?.length) {
    return NextResponse.json({ error: "IA nao retornou slides estruturados", raw: res.output });
  }

  // Renderiza SVGs
  const svgs = renderCarrosselSVG({
    slides: parsed.slides,
    titulo_capa: parsed.titulo_capa,
    subtitulo_capa: parsed.subtitulo_capa,
    cor_primaria, cor_secundaria, marca_nome: marca,
  });

  return NextResponse.json({ slides: parsed.slides, svgs, metadata: parsed });
}
