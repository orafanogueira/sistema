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

  // tags max 180 chars (limite Suno e 200)
  const tagsRaw = opts.tags || opts.prompt;
  const tags = tagsRaw.slice(0, 180);

  const body: Record<string, unknown> = custom
    ? {
        custom_mode: true,
        prompt: opts.lyrics || opts.prompt,
        title: opts.title || "Untitled",
        tags,
        make_instrumental: opts.make_instrumental ?? false,
        mv: "chirp-v3-5",
      }
    : {
        custom_mode: false,
        gpt_description_prompt: opts.prompt.slice(0, 380),
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
  // SunoAPI.com pode retornar varias estruturas — tenta todas
  type ClipShape = { id?: string };
  const data = created.data ?? created;
  const taskId: string | undefined = data.task_id || data.taskId || created.task_id || created.taskId;
  const clipIds: string[] =
    data.clip_ids ||
    created.clip_ids ||
    (Array.isArray(data.clips) ? data.clips.map((c: ClipShape) => c.id).filter(Boolean) : []) ||
    (data.id ? [data.id] : []);
  // se nao tem clip_ids mas tem task_id, polleia pelo task_id depois
  if (clipIds.length === 0 && !taskId) {
    throw new Error(`SunoAPI resposta sem clip_ids/task_id. Raw: ${JSON.stringify(created).slice(0, 400)}`);
  }

  // 2. poll ate completar
  const maxPolls = opts.max_polls || 40;
  const pollUrl = clipIds.length > 0
    ? `${BASE}/api/v1/suno/clips?ids=${clipIds.join(",")}`
    : `${BASE}/api/v1/suno/task/${taskId}`;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 4000));

    const statusRes = await fetch(pollUrl, {
      headers: { "Authorization": `Bearer ${key}` },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    // tenta varias estruturas de resposta
    const payload = statusData.data || statusData;
    const clips: ClipResponse[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.clips)
        ? payload.clips
        : payload.audio_url
          ? [payload as ClipResponse]
          : [];

    if (clips.length === 0) continue;

    const completos = clips.filter((c) => (c.status === "complete" || c.status === "streaming") && c.audio_url);
    const expected = clipIds.length || 1;
    if (completos.length >= expected) {
      const first = completos[0];
      return {
        audio_url: first.audio_url || "",
        audio_url_2: completos[1]?.audio_url,
        title: first.title,
        duration: first.duration || first.metadata?.duration,
        lyrics: first.metadata?.prompt,
        task_id: clipIds.join(",") || taskId || "",
      };
    }

    const fail = clips.find((c) => c.status === "error" || c.status === "failed");
    if (fail) throw new Error(`SunoAPI clip falhou: ${fail.status}`);
  }
  throw new Error("SunoAPI timeout — musica demorou mais de 3min");
}
