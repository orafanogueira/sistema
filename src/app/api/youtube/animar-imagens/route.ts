import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 600;

/** Veo 3 (Google) - predict long running + polling. */
async function veoAnimate(imgUrl: string, prompt: string, model: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");

  // Veo nao baixa de URL: precisa enviar bytes inline (base64)
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error("nao baixou imagem source");
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type") || "image/png";

  const startUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${key}`;
  const startRes = await fetch(startUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{
        prompt: prompt || "smooth cinematic camera movement",
        image: { bytesBase64Encoded: buf.toString("base64"), mimeType: mime },
      }],
      parameters: { aspectRatio: "16:9", personGeneration: "allow_adult" },
    }),
  });
  if (!startRes.ok) throw new Error(`Veo start ${startRes.status}: ${(await startRes.text()).slice(0, 250)}`);
  const startData = await startRes.json();
  const opName: string = startData.name;
  if (!opName) throw new Error("Veo nao retornou operation name");

  // poll operation
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const opRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opName}?key=${key}`);
    if (!opRes.ok) continue;
    const op = await opRes.json();
    if (op.done) {
      if (op.error) throw new Error(`Veo: ${op.error.message || JSON.stringify(op.error)}`);
      type Pred = { video?: { uri?: string } };
      const preds = op.response?.predictions || op.response?.generateVideoResponse?.generatedSamples || [];
      const first = preds[0] as Pred;
      const videoUrl = first?.video?.uri || op.response?.video?.uri;
      if (!videoUrl) throw new Error(`Veo done sem video.uri: ${JSON.stringify(op.response).slice(0, 200)}`);
      // Veo retorna URL com auth — baixa e re-hosta
      const vRes = await fetch(`${videoUrl}&key=${key}`);
      if (!vRes.ok) throw new Error("Veo video.uri 404");
      const vBuf = Buffer.from(await vRes.arrayBuffer());
      // sobe pro Storage
      const supabase = await createClient();
      const path = `youtube-videos/veo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp4`;
      const { error: upErr } = await supabase.storage.from("social-media").upload(path, vBuf, {
        contentType: "video/mp4", upsert: false,
      });
      if (upErr) throw new Error(`Storage: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);
      return pub.publicUrl;
    }
  }
  throw new Error("Veo timeout (>5min)");
}

/**
 * Anima imagens estaticas via fal.ai (Kling/LTX/Luma).
 * Input: { imagens: [{id, url, prompt?}], modelo, duration, prompt_movimento? }
 * Output: { videos: [{source_img_id, video_url}] }
 */

interface FalQueueResponse { request_id?: string; status_url?: string; }

async function falCreate(endpoint: string, payload: unknown): Promise<FalQueueResponse> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY ausente — adicione no Vercel");
  const r = await fetch(`https://queue.fal.run${endpoint}`, {
    method: "POST",
    headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`fal create ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function falPoll(statusUrl: string, maxPolls = 60): Promise<{ video?: { url: string } }> {
  const key = process.env.FAL_KEY!;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 5000));   // 5s entre polls
    const r = await fetch(statusUrl, { headers: { "Authorization": `Key ${key}` } });
    if (!r.ok) continue;
    const d = await r.json();
    if (d.status === "COMPLETED") {
      // busca resultado
      const resUrl = statusUrl.replace("/status", "");
      const resR = await fetch(resUrl, { headers: { "Authorization": `Key ${key}` } });
      if (!resR.ok) throw new Error("fal result fetch falhou");
      return resR.json();
    }
    if (d.status === "FAILED") throw new Error("fal task falhou");
  }
  throw new Error("fal timeout (>5min)");
}

interface ImgIn { id: string; url: string; prompt?: string }

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { imagens, modelo, duration, prompt_movimento } = await req.json() as {
    imagens: ImgIn[]; modelo?: string; duration?: number; prompt_movimento?: string;
  };
  if (!Array.isArray(imagens) || imagens.length === 0) return new NextResponse("imagens obrigatorias", { status: 400 });
  if (imagens.length > 10) return new NextResponse("max 10 imagens por request", { status: 400 });

  const isVeo = modelo === "veo-3" || modelo === "veo-3-fast" || modelo === "veo-2";
  const veoModel = modelo === "veo-3-fast" ? "veo-3.0-fast-generate-001"
    : modelo === "veo-2" ? "veo-2.0-generate-001"
    : "veo-3.0-generate-001";

  const endpoint = modelo === "ltx" ? "/fal-ai/ltx-video/image-to-video"
    : modelo === "luma" ? "/fal-ai/luma-dream-machine/image-to-video"
    : "/fal-ai/kling-video/v2/master/image-to-video";

  const dur = Math.max(3, Math.min(10, Number(duration) || 5));

  const videos: Array<{ source_img_id: string; video_url: string }> = [];
  const erros: Array<{ source_img_id: string; erro: string }> = [];

  // Veo: sequencial pra nao estourar quota
  // fal.ai: concurrency 2
  const conc = isVeo ? 1 : 2;
  for (let i = 0; i < imagens.length; i += conc) {
    const batch = imagens.slice(i, i + conc);
    const results = await Promise.all(batch.map(async (img) => {
      try {
        if (isVeo) {
          const url = await veoAnimate(img.url, prompt_movimento || img.prompt || "", veoModel);
          return { source_img_id: img.id, video_url: url };
        }
        const payload: Record<string, unknown> = {
          image_url: img.url,
          duration: `${dur}`,
          prompt: prompt_movimento || img.prompt || "smooth cinematic camera movement",
        };
        const created = await falCreate(endpoint, payload);
        const statusUrl = created.status_url || `https://queue.fal.run${endpoint}/requests/${created.request_id}/status`;
        const result = await falPoll(statusUrl);
        const videoUrl = result.video?.url;
        if (!videoUrl) throw new Error("fal nao retornou video.url");
        return { source_img_id: img.id, video_url: videoUrl };
      } catch (e: unknown) {
        erros.push({ source_img_id: img.id, erro: e instanceof Error ? e.message : "erro" });
        return null;
      }
    }));
    for (const r of results) if (r) videos.push(r);
  }

  return NextResponse.json({
    videos,
    total_sucesso: videos.length,
    total_tentativas: imagens.length,
    erros,
  });
}
