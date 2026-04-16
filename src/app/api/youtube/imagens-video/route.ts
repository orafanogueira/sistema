import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 300;

const SYSTEM = `Voce e diretor de arte especialista em videos de CANAL DARK do YouTube.
Dado um titulo de video, gera de 8 a 16 prompts de imagem em INGLES para composicao visual do video completo (capa + desenvolvimento + climax + encerramento).

REGRAS DOS PROMPTS:
- Em INGLES (Gemini performa melhor)
- Estilo FOTOGRAFICO (cinematic, photorealistic, documentary)
- 16:9 (paisagem) obrigatorio — descrever composicao horizontal
- CRITICAL: Include "NO text, no letters, no words, no writing, no signs, no logos, clean image, minimalist scenery" in EVERY prompt
- Se aparecer texto em placa/objeto, deve ser em PORTUGUES (contexto brasileiro)
- NUNCA gerar imagens com texto legivel em ingles
- Incluir: iluminacao, angulo, mood, personagens (sem rostos especificos), ambiente
- Coerencia visual entre as imagens (mesmo estilo/paleta)
- Progressao narrativa: cenas iniciais, desenvolvimento, momentos de tensao/viradas, encerramento

Output JSON estrito, sem markdown:
{
  "prompts": [
    { "ordem": 1, "descricao_cena": "cena de abertura mostrando X", "prompt_ingles": "cinematic photograph..." },
    ...
  ]
}
Gere EXATAMENTE a quantidade pedida.`;

async function falImage(prompt: string, modelo: "flux-schnell" | "flux-pro" | "ideogram"): Promise<{ buffer: Buffer; mime: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY ausente no Vercel");

  const endpoint = modelo === "flux-pro" ? "fal-ai/flux-pro/v1.1"
    : modelo === "ideogram" ? "fal-ai/ideogram/v2"
    : "fal-ai/flux/schnell";

  // sync call (mais simples que queue pra imagens)
  const r = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: modelo === "flux-schnell" ? 4 : 28,
      num_images: 1,
      enable_safety_checker: false,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`fal ${modelo} ${r.status}: ${txt.slice(0, 250)}`);
  }
  const data = await r.json();
  const imgUrl = data.images?.[0]?.url;
  if (!imgUrl) throw new Error("fal nao retornou url");
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error("fal imgUrl 404");
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type") || "image/png";
  return { buffer, mime };
}

async function geminiImage(prompt: string): Promise<{ data: string; mime: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente no Vercel");

  const todosErros: string[] = [];

  const imagenModels = [
    "imagen-4.0-generate-001",
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-ultra-generate-001",
    "imagen-3.0-generate-001",
  ];
  for (const model of imagenModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: "16:9" },
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        todosErros.push(`${model}=${r.status}:${txt.slice(0, 100).replace(/\s+/g, " ")}`);
        continue;
      }
      const data = await r.json();
      const pred = data.predictions?.[0];
      const b64 = pred?.bytesBase64Encoded || pred?.image?.bytesBase64Encoded;
      if (!b64) {
        todosErros.push(`${model}=sem-bytes:${JSON.stringify(data).slice(0, 100)}`);
        continue;
      }
      return { data: b64, mime: pred.mimeType || "image/png" };
    } catch (e: unknown) {
      todosErros.push(`${model}=ex:${e instanceof Error ? e.message.slice(0, 80) : "erro"}`);
    }
  }

  const geminiModels = [
    "gemini-3-pro-image-preview",
    "nano-banana-pro-preview",
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
  ];
  const finalPrompt = `${prompt}\n\nGenerate in horizontal 16:9 landscape orientation, widescreen format.`;

  for (const model of geminiModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        todosErros.push(`${model}=${r.status}:${txt.slice(0, 100).replace(/\s+/g, " ")}`);
        continue;
      }
      const data = await r.json();
      type Part = { inlineData?: { data?: string; mimeType?: string }; text?: string };
      const parts = (data.candidates?.[0]?.content?.parts as Part[] | undefined) || [];
      const imgPart = parts.find((p) => p.inlineData?.data);
      if (!imgPart?.inlineData?.data) {
        const finish = data.candidates?.[0]?.finishReason || "?";
        todosErros.push(`${model}=sem-img(${finish})`);
        continue;
      }
      return { data: imgPart.inlineData.data, mime: imgPart.inlineData.mimeType || "image/png" };
    } catch (e: unknown) {
      todosErros.push(`${model}=ex:${e instanceof Error ? e.message.slice(0, 80) : "erro"}`);
    }
  }

  throw new Error(`TODOS falharam: ${todosErros.join(" | ")}`);
}

/**
 * Gera prompts + imagens pro video:
 *  - Input: { titulo, qtd (8-16), tema, gerar_imagens }
 *  - Output: prompts + (se gerar_imagens) URLs das imagens no Storage
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { titulo, qtd, tema, gerar_imagens, modelo } = await req.json();
  if (!titulo?.trim()) return new NextResponse("titulo obrigatorio", { status: 400 });
  const total = Math.max(2, Math.min(4, Number(qtd) || 4));
  const modeloImg: "gemini" | "flux-schnell" | "flux-pro" | "ideogram" = modelo || "flux-schnell";

  // 1) Claude gera prompts
  const userMsg = `Titulo do video: ${titulo}
Tema/contexto: ${tema || "(derivar do titulo)"}
Quantidade de imagens: ${total}`;

  let prompts: Array<{ ordem: number; descricao_cena: string; prompt_ingles: string }>;
  try {
    const text = await aiChat({
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      temperature: 0.75,
      maxTokens: 4000,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude nao devolveu JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    prompts = (parsed.prompts || []).slice(0, total);
  } catch (e: unknown) {
    return new NextResponse(`Claude: ${e instanceof Error ? e.message : "erro"}`, { status: 500 });
  }

  // 2) Se nao gerar imagens, retorna so os prompts
  if (!gerar_imagens) {
    return NextResponse.json({ prompts, total_prompts: prompts.length });
  }

  // 3) Gera imagens. Concurrency 1 pra Gemini (rate limit 15 RPM), 3 pra fal.ai
  const assets: Array<{ id: string; url: string; ordem: number; prompt: string }> = [];
  const erros: Array<{ ordem: number; erro: string }> = [];
  const concurrency = modeloImg === "gemini" ? 1 : 3;
  for (let i = 0; i < prompts.length; i += concurrency) {
    // delay 5s entre batches Gemini pra respeitar rate limit 15 RPM
    if (i > 0 && modeloImg === "gemini") {
      await new Promise((r) => setTimeout(r, 5000));
    }
    const batch = prompts.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (p) => {
      let buffer: Buffer; let mime: string;
      try {
        if (modeloImg === "gemini") {
          const img = await geminiImage(p.prompt_ingles);
          buffer = Buffer.from(img.data, "base64");
          mime = img.mime;
        } else {
          const img = await falImage(p.prompt_ingles, modeloImg);
          buffer = img.buffer;
          mime = img.mime;
        }
      } catch (e: unknown) {
        erros.push({ ordem: p.ordem, erro: e instanceof Error ? e.message : "erro" });
        return null;
      }
      const ext = mime.split("/")[1] || "png";
      const path = `${m.tenant_id}/yt-video-${Date.now()}-${p.ordem}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, {
        contentType: mime, upsert: false,
      });
      if (upErr) { erros.push({ ordem: p.ordem, erro: `Storage: ${upErr.message}` }); return null; }
      const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);
      const { data: row } = await supabase.from("youtube_video_imagens").insert({
        tenant_id: m.tenant_id,
        titulo_video: titulo,
        prompt_usado: p.prompt_ingles,
        url: pub.publicUrl,
        storage_path: path,
        position: p.ordem - 1,
        aspect_ratio: "16:9",
        created_by: user.id,
      }).select().single();
      return { id: row?.id || "", url: pub.publicUrl, ordem: p.ordem, prompt: p.prompt_ingles };
    }));
    for (const r of results) if (r) assets.push(r);
  }

  return NextResponse.json({
    prompts,
    total_prompts: prompts.length,
    total_imagens: assets.length,
    imagens: assets,
    erros,
  });
}

/** GET: lista galeria de imagens ja geradas (historico por tenant) */
export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const titulo = url.searchParams.get("titulo");
  let q = supabase.from("youtube_video_imagens")
    .select("id,url,storage_path,titulo_video,prompt_usado,position,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (titulo) q = q.eq("titulo_video", titulo);
  const { data } = await q;
  return NextResponse.json(data || []);
}
