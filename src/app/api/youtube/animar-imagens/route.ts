import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 600;

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

  const endpoint = modelo === "ltx" ? "/fal-ai/ltx-video/image-to-video"
    : modelo === "luma" ? "/fal-ai/luma-dream-machine/image-to-video"
    : "/fal-ai/kling-video/v2/master/image-to-video";

  const dur = Math.max(3, Math.min(10, Number(duration) || 5));

  const videos: Array<{ source_img_id: string; video_url: string }> = [];
  const erros: Array<{ source_img_id: string; erro: string }> = [];

  // processa em paralelo com concurrency 2 (fal.ai rate limit)
  const conc = 2;
  for (let i = 0; i < imagens.length; i += conc) {
    const batch = imagens.slice(i, i + conc);
    const results = await Promise.all(batch.map(async (img) => {
      try {
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
