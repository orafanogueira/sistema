import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarEbook } from "@/lib/maxxima/ebook-gerador";

/**
 * Gera ebook completo via IA em multi-step.
 * ATENCAO: pode demorar 30-60s. Vercel free timeout = 10s, pro = 60s.
 * Pra free, usar Vercel Functions ou quebrar em etapas.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { oferta_id, tema, publico, promessa, num_capitulos, tom } = body;

  try {
    const ebook = await gerarEbook({ tema, publico, promessa, num_capitulos, tom });

    // Salva como seo_content_item tipo 'ebook'
    const { data: proj } = await supabase.from("seo_projects").select("id")
      .eq("tenant_id", m.tenant_id).limit(1).maybeSingle();

    let content_id: string | null = null;
    if (proj) {
      const { data: item } = await supabase.from("seo_content_items").insert({
        seo_project_id: proj.id,
        type: "blog_post", title: ebook.titulo,
        body_html: ebook.markdown_completo,
        status: "draft", generated_by_ai: true,
      }).select().single();
      content_id = item?.id || null;
    }

    if (oferta_id) {
      await supabase.from("maxxima_ofertas").update({ ebook_id: content_id, status: "produzindo" }).eq("id", oferta_id);
    }

    return NextResponse.json({ ebook, content_id });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
