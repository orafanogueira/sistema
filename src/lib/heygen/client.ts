/**
 * HeyGen API v2 — Avatares IA que falam
 * Docs: https://docs.heygen.com/reference
 * Env: HEYGEN_API_KEY
 */

const BASE = "https://api.heygen.com/v2";
const BASE_V1 = "https://api.heygen.com/v1";

function apiKey(): string {
  const k = process.env.HEYGEN_API_KEY;
  if (!k) throw new Error("HEYGEN_API_KEY ausente no Vercel");
  return k;
}

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
}

export interface HeyGenVoice {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio?: string;
}

/** Lista avatares disponíveis na conta HeyGen */
export async function listAvatars(): Promise<HeyGenAvatar[]> {
  const r = await fetch(`${BASE}/avatars`, {
    headers: { "X-Api-Key": apiKey() },
  });
  if (!r.ok) throw new Error(`HeyGen avatars ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.data?.avatars || data.avatars || [];
}

/** Lista vozes disponíveis (com filtro opcional por idioma) */
export async function listVoices(language?: string): Promise<HeyGenVoice[]> {
  const r = await fetch(`${BASE}/voices`, {
    headers: { "X-Api-Key": apiKey() },
  });
  if (!r.ok) throw new Error(`HeyGen voices ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const voices: HeyGenVoice[] = data.data?.voices || data.voices || [];
  if (language) {
    return voices.filter((v) => v.language?.toLowerCase().startsWith(language.toLowerCase()));
  }
  return voices;
}

/** Gera vídeo com avatar falando o texto (async — retorna video_id) */
export async function generateVideo(opts: {
  avatarId: string;
  voiceId: string;
  text: string;
  formato?: "9:16" | "16:9" | "1:1";
  backgroundColor?: string;
  title?: string;
}): Promise<{ video_id: string }> {
  const dimensions = opts.formato === "16:9"
    ? { width: 1920, height: 1080 }
    : opts.formato === "1:1"
    ? { width: 1080, height: 1080 }
    : { width: 720, height: 1280 }; // 9:16 default

  const body = {
    video_inputs: [{
      character: {
        type: "avatar" as const,
        avatar_id: opts.avatarId,
        avatar_style: "normal",
      },
      voice: {
        type: "text" as const,
        input_text: opts.text,
        voice_id: opts.voiceId,
      },
      background: {
        type: "color" as const,
        value: opts.backgroundColor || "#0D1117",
      },
    }],
    dimension: dimensions,
    title: opts.title || `Vídeo IA ${new Date().toISOString().slice(0, 10)}`,
  };

  const r = await fetch(`${BASE}/video/generate`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`HeyGen generate ${r.status}: ${txt.slice(0, 300)}`);
  }

  const data = await r.json();
  return { video_id: data.data?.video_id || data.video_id };
}

/** Consulta status do vídeo (processando, pronto, erro) */
export async function getVideoStatus(videoId: string): Promise<{
  status: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}> {
  const r = await fetch(`${BASE_V1}/video_status.get?video_id=${videoId}`, {
    headers: { "X-Api-Key": apiKey() },
  });
  if (!r.ok) throw new Error(`HeyGen status ${r.status}`);
  const data = await r.json();
  const d = data.data || data;
  return {
    status: d.status,
    video_url: d.video_url,
    thumbnail_url: d.thumbnail_url,
    duration: d.duration,
    error: d.error?.message || d.error,
  };
}
