import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 600;

/**
 * Monta video final: clips animados (MP4s) + audio (narracao ou musica).
 * Usa Shotstack API pra renderizar.
 *
 * Input: { clips: [{url, duration}], audio_url, titulo }
 * Output: { render_id, status }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const key = process.env.SHOTSTACK_API_KEY;
  if (!key) return new NextResponse("SHOTSTACK_API_KEY ausente — adicione no Vercel (crie conta gratis em shotstack.io)", { status: 500 });

  const { clips, audio_url, audio_duration } = await req.json() as {
    clips: Array<{ url: string; duration?: number }>;
    audio_url?: string;
    audio_duration?: number;
  };
  if (!Array.isArray(clips) || clips.length === 0) return new NextResponse("clips obrigatorios", { status: 400 });

  // transicoes aleatorias do Shotstack
  const TRANSITIONS = ["fade", "fadeSlow", "zoom", "slideLeft", "slideRight", "slideUp", "slideDown", "wipeLeft", "wipeRight", "carouselLeft", "carouselRight"];
  const randomTransition = () => TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];

  const targetDuration = audio_url && audio_duration && audio_duration > 0
    ? Math.max(audio_duration, 5)
    : clips.reduce((s, c) => s + (c.duration || 5), 0);

  // monta timeline com loop se preciso
  const videoClips: Array<Record<string, unknown>> = [];
  let currentTime = 0;
  let clipIndex = 0;
  while (currentTime < targetDuration) {
    const src = clips[clipIndex % clips.length];
    const dur = Math.min(src.duration || 5, targetDuration - currentTime);
    if (dur < 0.5) break;
    videoClips.push({
      asset: { type: "video", src: src.url },
      start: currentTime,
      length: dur,
      transition: { in: randomTransition(), out: randomTransition() },
      effect: ["zoomIn", "zoomOut", "slideLeft", "slideRight"][Math.floor(Math.random() * 4)],
    });
    currentTime += dur;
    clipIndex++;
  }

  const tracks: Array<{ clips: unknown[] }> = [{ clips: videoClips }];

  if (audio_url) {
    tracks.push({
      clips: [{
        asset: { type: "audio", src: audio_url, volume: 1 },
        start: 0,
        length: targetDuration,
      }],
    });
  }

  const timeline = {
    timeline: {
      // SO uma fonte de audio: track (nao soundtrack, senao toca duas vezes = eco)
      tracks,
    },
    output: {
      format: "mp4",
      resolution: "hd",
      fps: 30,
    },
  };

  // envia pro Shotstack
  const env = process.env.SHOTSTACK_ENV || "stage";  // stage=sandbox, v1=production
  const renderRes = await fetch(`https://api.shotstack.io/${env}/render`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(timeline),
  });
  if (!renderRes.ok) {
    const txt = await renderRes.text();
    return new NextResponse(`Shotstack render ${renderRes.status}: ${txt.slice(0, 300)}`, { status: 500 });
  }
  const renderData = await renderRes.json();
  const renderId = renderData.response?.id;
  if (!renderId) return new NextResponse(`Shotstack sem render id: ${JSON.stringify(renderData).slice(0, 300)}`, { status: 500 });

  return NextResponse.json({ render_id: renderId, status: "rendering", total_duration: currentTime });
}

/** GET: checa status do render e retorna URL quando pronto */
export async function GET(req: Request) {
  const key = process.env.SHOTSTACK_API_KEY;
  if (!key) return new NextResponse("SHOTSTACK_API_KEY ausente", { status: 500 });

  const url = new URL(req.url);
  const renderId = url.searchParams.get("render_id");
  if (!renderId) return new NextResponse("render_id obrigatorio", { status: 400 });

  const env = process.env.SHOTSTACK_ENV || "stage";
  const r = await fetch(`https://api.shotstack.io/${env}/render/${renderId}`, {
    headers: { "x-api-key": key },
  });
  if (!r.ok) return NextResponse.json({ status: "error", message: `${r.status}` });
  const data = await r.json();
  const status = data.response?.status;
  const videoUrl = data.response?.url;

  if (status === "done" && videoUrl) {
    return NextResponse.json({ status: "done", video_url: videoUrl });
  }
  if (status === "failed") {
    return NextResponse.json({ status: "failed", message: data.response?.error || "render falhou" });
  }
  return NextResponse.json({ status: "rendering", progress: data.response?.progress || 0 });
}
