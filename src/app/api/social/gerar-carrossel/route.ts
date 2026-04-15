import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

/**
 * Gera carrossel completo:
 *  1. Claude gera JSON com estrutura (capa + N conteudos + CTA)
 *  2. Se gerar_imagens=true: Gemini cria imagem pra cada slide em paralelo
 *  3. Salva assets ordenados e devolve
 */

const SYSTEM = `Voce e especialista em carrosseis virais de Instagram. Cria roteiros que prendem atencao e levam acao.

REGRAS OBRIGATORIAS:
- Slide 1 (capa): HOOK brutal que PARA o scroll. Max 12 palavras. Pode usar numero (5 erros, 3 segredos, etc)
- Slides do meio: 1 insight FORTE por slide. Texto de no maximo 15 palavras. Linguagem direta e acionavel.
- Ultimo slide (CTA): chamada ESPECIFICA (nao "me segue"). Exemplo bom: "Comenta SOCORRO e te mando o checklist completo no direct"
- Linguagem: humana, direta, sem jargao corporativo
- Tom: consultivo, nao vendedor

PROMPTS DE IMAGEM (em INGLES, estilo profissional):
- Descreva cena REAL e fotografica, nao ilustracao/cartoon
- Inclua: lighting, angle, mood
- NUNCA inclua texto/letras na imagem
- Capa: visual impactante que complementa o hook (nao literal)
- Slides de conteudo: imagem que REFORCA o insight (nao literal)
- Slide CTA: imagem que sugira proximidade/conversa/acao

Output: JSON estrito, sem markdown, sem explicacao:
{
  "slides": [
    {
      "ordem": 1,
      "tipo": "capa",
      "titulo": "hook forte de ate 12 palavras",
      "texto": "subtexto opcional de ate 20 palavras ou vazio",
      "prompt_imagem": "english prompt for the image"
    },
    ...
  ],
  "copy_legenda": "copy pra caption do post no feed, tom IG, 3-5 linhas, termina com CTA"
}`;

async function geminiImage(prompt: string, aspectRatio: string): Promise<{ data: string; mime: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  type Part = { inlineData?: { data?: string; mimeType?: string } };
  const part = (data.candidates?.[0]?.content?.parts as Part[] | undefined)?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  return { data: part.inlineData.data, mime: part.inlineData.mimeType || "image/png" };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { briefing, slides_count, cliente_id, aspect_ratio, gerar_imagens } = await req.json();
  if (!briefing?.trim()) return new NextResponse("briefing obrigatorio", { status: 400 });
  const total = Math.min(10, Math.max(2, Number(slides_count) || 5));
  const ratio = aspect_ratio === "1:1" ? "1:1" : "3:4";  // 4:5 -> Gemini 3:4

  // 1) Claude gera estrutura
  const userMsg = `Tema/briefing: ${briefing}
Quantidade total de slides: ${total} (inclui 1 capa + conteudo + 1 CTA final)`;

  let parsed: { slides: Array<{ ordem: number; tipo: string; titulo: string; texto: string; prompt_imagem: string }>; copy_legenda: string };
  try {
    const text = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.85,
      maxTokens: 3000,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude nao devolveu JSON");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e: unknown) {
    return new NextResponse(`Claude: ${e instanceof Error ? e.message : "erro"}`, { status: 500 });
  }

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    return new NextResponse("Claude devolveu estrutura invalida", { status: 500 });
  }

  // 2) Gera imagens (se pedido)
  const assets: Array<{ id: string; url: string; tipo: string; position: number; titulo: string; texto: string; prompt_imagem: string }> = [];

  if (gerar_imagens) {
    // paralelo, mas limita concorrencia em 3 (pra nao estourar rate limit Gemini)
    const concurrency = 3;
    for (let i = 0; i < parsed.slides.length; i += concurrency) {
      const batch = parsed.slides.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(async (slide) => {
        const img = await geminiImage(slide.prompt_imagem, ratio);
        if (!img) return { slide, error: "gemini_failed" };
        const ext = img.mime.split("/")[1] || "png";
        const path = `${m.tenant_id}/carrossel-${Date.now()}-${slide.ordem}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const buffer = Buffer.from(img.data, "base64");
        const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, {
          contentType: img.mime, upsert: false,
        });
        if (upErr) return { slide, error: upErr.message };
        const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);
        const { data: asset } = await supabase.from("social_media_assets").insert({
          tenant_id: m.tenant_id,
          cliente_id: cliente_id || null,
          url: pub.publicUrl,
          storage_path: path,
          tipo: "imagem",
          mime_type: img.mime,
          size_bytes: buffer.length,
          position: slide.ordem - 1,
          created_by: user.id,
        }).select().single();
        return { slide, asset };
      }));
      for (const r of results) {
        if ("asset" in r && r.asset) {
          assets.push({
            id: r.asset.id,
            url: r.asset.url,
            tipo: "imagem",
            position: r.slide.ordem - 1,
            titulo: r.slide.titulo,
            texto: r.slide.texto,
            prompt_imagem: r.slide.prompt_imagem,
          });
        }
      }
    }
  }

  return NextResponse.json({
    slides: parsed.slides,
    copy_legenda: parsed.copy_legenda,
    assets,
    total_gerados: assets.length,
    total_esperados: parsed.slides.length,
  });
}
