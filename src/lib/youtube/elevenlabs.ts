/**
 * ElevenLabs TTS wrapper.
 * Docs: https://elevenlabs.io/docs/api-reference
 */

const BASE = "https://api.elevenlabs.io/v1";

function apiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY ausente");
  return k;
}

export interface Voice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  preview_url?: string;
  category?: string;
}

/** Lista vozes disponiveis (filtra pt-BR / en / etc). */
export async function listVoices(): Promise<Voice[]> {
  const r = await fetch(`${BASE}/voices`, { headers: { "xi-api-key": apiKey() } });
  if (!r.ok) throw new Error(`ElevenLabs voices ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.voices || [];
}

/** Retorna info do usuario ElevenLabs (creditos restantes, limite). */
export async function getUserInfo(): Promise<{ character_count: number; character_limit: number; remaining: number } | null> {
  try {
    const r = await fetch(`${BASE}/user/subscription`, { headers: { "xi-api-key": apiKey() } });
    if (!r.ok) return null;
    const data = await r.json();
    const used = data.character_count || 0;
    const limit = data.character_limit || 0;
    return { character_count: used, character_limit: limit, remaining: Math.max(0, limit - used) };
  } catch { return null; }
}

/** TTS: gera audio MP3 de um texto. Retorna buffer. */
export async function textToSpeech(opts: {
  text: string;
  voice_id: string;
  model_id?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
}): Promise<{ buffer: Buffer; chars: number }> {
  const r = await fetch(`${BASE}/text-to-speech/${opts.voice_id}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text: opts.text,
      // v2.5 Turbo multilingual = melhor qualidade pra portugues com velocidade boa
      model_id: opts.model_id || "eleven_turbo_v2_5",
      language_code: "pt",   // forca portugues no modelo multilingual
      voice_settings: {
        stability: opts.stability ?? 0.5,
        similarity_boost: opts.similarity_boost ?? 0.75,
        style: opts.style ?? 0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`ElevenLabs TTS ${r.status}: ${txt.slice(0, 300)}`);
  }

  const arrayBuffer = await r.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), chars: opts.text.length };
}

/** Vozes em portugues pt-BR mais recomendadas pra canal dark (escolha curada). */
export const VOZES_RECOMENDADAS_PT = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", descricao: "feminina, calma, narrativa" },
  { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", descricao: "feminina, jovem, animada" },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", descricao: "masculina, profunda, autoritaria" },
  { voice_id: "VR6AewLTigWG4xSOukaG", name: "Arnold", descricao: "masculina, grave, cinematografica" },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", descricao: "masculina, seria, trailer" },
  { voice_id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", descricao: "masculina, clara, versatil" },
];
