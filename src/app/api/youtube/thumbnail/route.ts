import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic } from "@/lib/integrations/ai";
import { getRecentVideos } from "@/lib/youtube/data-api";

export const maxDuration = 180;

async function geminiImage(prompt: string): Promise<{ data: string; mime: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  type Part = { inlineData?: { data?: string; mimeType?: string } };
  const part = (data.candidates?.[0]?.content?.parts as Part[] | undefined)?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  return { data: part.inlineData.data, mime: part.inlineData.mimeType || "image/png" };
}

/**
 * Thumbnail magnetica:
 *  1. Se canal_referencia_id: busca videos recentes do canal, pega 3-5 thumbs
 *  2. Claude Vision analisa padroes (cores, elementos, layout, fontes, rosto)
 *  3. Gera prompt pro Gemini baseado no padrao + titulo do video novo
 *  4. Gemini cria nova thumb 16:9
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { titulo, canal_referencia_id, estilo_custom, texto_destaque, referencia_url } = await req.json();
  if (!titulo?.trim()) return new NextResponse("titulo obrigatorio", { status: 400 });

  let padroes = "";
  let thumbsUrls: string[] = [];

  // 1. se tem canal de referencia, analisa thumbs
  if (canal_referencia_id) {
    const { data: canal } = await supabase.from("youtube_canais_minerados")
      .select("channel_id,channel_name").eq("id", canal_referencia_id).maybeSingle();
    if (canal) {
      try {
        const videos = await getRecentVideos(canal.channel_id, 5);
        thumbsUrls = videos.map((v) => `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`);
      } catch {}

      if (thumbsUrls.length > 0) {
        // baixa thumbs, converte pra base64
        const imagesBase64: Array<{ data: string; media_type: "image/jpeg" | "image/png" }> = [];
        for (const url of thumbsUrls.slice(0, 4)) {
          try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const buf = Buffer.from(await resp.arrayBuffer());
            const contentType = resp.headers.get("content-type") || "image/jpeg";
            const mt = contentType.includes("png") ? "image/png" : "image/jpeg";
            imagesBase64.push({ data: buf.toString("base64"), media_type: mt });
          } catch {}
        }

        if (imagesBase64.length > 0) {
          try {
            const anthropic = getAnthropic();
            const contentParts = [
              {
                type: "text" as const,
                text: `Voce e especialista em thumbnails virais de YouTube. Analise as ${imagesBase64.length} thumbnails abaixo do canal "${canal.channel_name}" e identifique PADROES visuais em formato JSON:

{
  "paleta_cores": "cores dominantes (ex: vermelho + amarelo + preto)",
  "tipografia": "estilo de texto (se houver)",
  "elementos_comuns": "setas, circulos, personagens, objetos, expressoes faciais",
  "layout": "composicao (ex: texto esquerda + rosto direita, etc)",
  "mood": "clima emocional (tensao, curiosidade, surpresa)",
  "diferencial": "o que faz clicar"
}

Retorne APENAS o JSON, sem markdown.`,
              },
              ...imagesBase64.map((img) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: img.media_type, data: img.data },
              })),
            ];

            const res = await anthropic.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: 1500,
              messages: [{ role: "user", content: contentParts }],
            });
            const textBlock = res.content.find((b) => b.type === "text");
            padroes = textBlock && "text" in textBlock ? textBlock.text : "";
          } catch (e) {
            console.error("[thumb vision]", e);
          }
        }
      }
    }
  }

  // 2. monta prompt final
  const hasText = texto_destaque?.trim();
  const textInstruction = hasText
    ? `IMPORTANT: Render this EXACT text prominently on the image in bold, large, eye-catching font: "${texto_destaque}". The text must be fully readable and positioned for maximum impact. Use contrasting colors (white/yellow text with dark shadow/outline). Text should take up 30-40% of the image area.`
    : `Do NOT include any text, letters or words in the image.`;

  const promptFinal = `Create a high-impact YouTube thumbnail in 16:9 for this video title: "${titulo}".

${textInstruction}

${padroes ? `Follow this visual pattern/DNA (reverse-engineered from a successful similar channel):
${padroes}

Use similar color palette, composition style and emotional mood. But make it unique.` : ""}

${estilo_custom ? `Additional style: ${estilo_custom}` : ""}

Style requirements:
- Photorealistic cinematic look
- High contrast, saturated colors that pop on YouTube
- Clear focal point, rule-of-thirds composition
- MUST include a person (young adult, facing camera) with exaggerated facial expression showing shock/surprise/excitement — mouth open, wide eyes, eyebrows raised. The person should occupy 40-50% of the frame on one side.
- Professional YouTube thumbnail aesthetic (MrBeast, Casimiro, Dotti style)
- 1280x720 quality, optimized for YouTube grid`;

  // 3. Gera thumb via fal.ai — Ideogram v2 (melhor pra texto) ou Flux
  let buffer: Buffer;
  let mime: string;
  const falKey = process.env.FAL_KEY;
  if (!falKey) return new NextResponse("FAL_KEY ausente no Vercel", { status: 500 });

  try {
    // Ideogram v2 pra thumbs com texto, Flux Pro pra thumbs sem texto
    const endpoint = hasText ? "fal-ai/ideogram/v2" : "fal-ai/flux-pro/v1.1";

    const falBody: Record<string, unknown> = {
      prompt: promptFinal,
      image_size: "landscape_16_9",
      num_images: 1,
    };

    // Ideogram-specific configs
    if (hasText) {
      falBody.style = "realistic";
      falBody.magic_prompt = true;
    } else {
      falBody.num_inference_steps = 28;
      falBody.enable_safety_checker = false;
    }

    // Imagem de referencia (style reference)
    if (referencia_url) {
      falBody.image_url = referencia_url;
      falBody.strength = 0.35;
    }

    const falRes = await fetch(`https://fal.run/${endpoint}`, {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(falBody),
    });
    if (!falRes.ok) throw new Error(`fal ${falRes.status}: ${(await falRes.text()).slice(0, 250)}`);
    const falData = await falRes.json();
    const imgUrl = falData.images?.[0]?.url;
    if (!imgUrl) throw new Error("fal sem url na resposta");
    const imgRes = await fetch(imgUrl);
    buffer = Buffer.from(await imgRes.arrayBuffer());
    mime = imgRes.headers.get("content-type") || "image/png";
  } catch (e: unknown) {
    return new NextResponse(`Thumb: ${e instanceof Error ? e.message : "erro"}`, { status: 500 });
  }

  const ext = mime.split("/")[1] || "png";
  const path = `${m.tenant_id}/yt-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, {
    contentType: mime, upsert: false,
  });
  if (upErr) return new NextResponse(`Storage: ${upErr.message}`, { status: 400 });
  const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);

  let padroesJson: Record<string, unknown> = {};
  if (padroes) {
    try {
      const match = padroes.match(/\{[\s\S]*\}/);
      if (match) padroesJson = JSON.parse(match[0]);
    } catch {}
  }

  const { data: row } = await supabase.from("youtube_thumbnails").insert({
    tenant_id: m.tenant_id,
    canal_referencia_id: canal_referencia_id || null,
    titulo, prompt_usado: promptFinal,
    padroes_detectados: padroesJson,
    url: pub.publicUrl, storage_path: path,
    created_by: user.id,
  }).select().single();

  return NextResponse.json({
    thumbnail: row,
    url: pub.publicUrl,
    padroes_detectados: padroesJson,
    thumbs_analisadas: thumbsUrls.length,
  });
}
