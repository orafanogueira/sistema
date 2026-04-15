/**
 * SunoAPI.com wrapper — geracao de musica via Suno AI (nao-oficial mas estavel).
 * Docs: https://sunoapi.com/docs
 *
 * Fluxo:
 *  1. POST /api/v1/suno/create  -> devolve {id} da task
 *  2. GET /api/v1/suno/clips?ids=id  -> poll ate status=complete
 *  3. Retorna audio_url(s)
 */

const BASE = "https://api.sunoapi.com";

function apiKey(): string {
  const k = process.env.SUNOAPI_KEY || process.env.SUNO_API_KEY;
  if (!k) throw new Error("SUNOAPI_KEY ausente — adicione no Vercel");
  return k;
}

export interface SunoResult {
  audio_url: string;
  audio_url_2?: string;
  title?: string;
  duration?: number;
  lyrics?: string;
  task_id?: string;
}

interface ClipResponse {
  id: string;
  status: string;
  audio_url?: string;
  title?: string;
  duration?: number;
  metadata?: { prompt?: string; duration?: number };
}

export async function gerarMusicaSuno(opts: {
  prompt: string;
  make_instrumental?: boolean;
  title?: string;
  lyrics?: string;
  tags?: string;
  max_polls?: number;
}): Promise<SunoResult> {
  const key = apiKey();

  // 1. cria task
  // SunoAPI.com suporta 2 modos:
  //  - custom_mode=false: IA escolhe style/letra baseado em gpt_description_prompt
  //  - custom_mode=true: user define prompt/tags/title manualmente
  const custom = !!(opts.lyrics || opts.tags);

  const body: Record<string, unknown> = custom
    ? {
        custom_mode: true,
        prompt: opts.lyrics || opts.prompt,
        title: opts.title || "Untitled",
        tags: opts.tags || opts.prompt,
        make_instrumental: opts.make_instrumental ?? false,
        mv: "chirp-v3-5",
      }
    : {
        custom_mode: false,
        gpt_description_prompt: opts.prompt,
        make_instrumental: opts.make_instrumental ?? false,
        mv: "chirp-v3-5",
      };

  const createRes = await fetch(`${BASE}/api/v1/suno/create`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`SunoAPI create ${createRes.status}: ${txt.slice(0, 300)}`);
  }
  const created = await createRes.json();
  const clipIds: string[] = created.data?.clip_ids || created.clip_ids || (created.id ? [created.id] : []);
  if (clipIds.length === 0) throw new Error("SunoAPI nao devolveu clip_ids");

  // 2. poll ate completar (ambos clips)
  const maxPolls = opts.max_polls || 40;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 4000));   // 4s entre polls

    const statusRes = await fetch(`${BASE}/api/v1/suno/clips?ids=${clipIds.join(",")}`, {
      headers: { "Authorization": `Bearer ${key}` },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    const clips = (statusData.data || statusData.clips || statusData) as ClipResponse[];

    if (!Array.isArray(clips)) continue;

    const completos = clips.filter((c) => c.status === "complete" || c.status === "streaming");
    if (completos.length >= clipIds.length) {
      const first = completos[0];
      return {
        audio_url: first.audio_url || "",
        audio_url_2: completos[1]?.audio_url,
        title: first.title,
        duration: first.duration || first.metadata?.duration,
        lyrics: first.metadata?.prompt,
        task_id: clipIds.join(","),
      };
    }

    // algum falhou?
    const fail = clips.find((c) => c.status === "error" || c.status === "failed");
    if (fail) throw new Error(`SunoAPI clip falhou: ${fail.status}`);
  }
  throw new Error("SunoAPI timeout — musica demorou mais de 3min");
}
