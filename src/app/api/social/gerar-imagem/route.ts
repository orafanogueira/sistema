import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Gera imagem via Gemini 2.5 Flash Image (nano banana) e salva no Supabase Storage.
 * Custo: ~$0.039 por imagem (free tier 500/dia em projetos novos).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return new NextResponse("GEMINI_API_KEY ausente — configurar no Vercel", { status: 500 });

  const { prompt, cliente_id, post_id, aspect_ratio } = await req.json();
  if (!prompt) return new NextResponse("prompt obrigatorio", { status: 400 });

  // Gemini 2.5 Flash Image API
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${key}`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: aspect_ratio ? { aspectRatio: aspect_ratio } : undefined,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return new NextResponse(`Gemini: ${txt.slice(0, 300)}`, { status: 500 });
  }

  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data
  );
  if (!part?.inlineData?.data) {
    return new NextResponse("Gemini nao retornou imagem", { status: 500 });
  }

  const mimeType = part.inlineData.mimeType || "image/png";
  const buffer = Buffer.from(part.inlineData.data, "base64");
  const ext = mimeType.split("/")[1] || "png";
  const path = `${m.tenant_id}/ia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (upErr) return new NextResponse(`Upload storage: ${upErr.message}`, { status: 400 });

  const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);

  const { data: asset, error: aErr } = await supabase.from("social_media_assets").insert({
    tenant_id: m.tenant_id,
    cliente_id: cliente_id || null,
    post_id: post_id || null,
    url: pub.publicUrl,
    storage_path: path,
    tipo: "imagem",
    mime_type: mimeType,
    size_bytes: buffer.length,
    created_by: user.id,
  }).select().single();
  if (aErr) return new NextResponse(aErr.message, { status: 400 });

  return NextResponse.json(asset);
}
