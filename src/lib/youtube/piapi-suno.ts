/**
 * PiAPI Suno wrapper - geracao de musica via API.
 * Docs: https://piapi.ai/docs/suno-api
 *
 * Fluxo:
 *  1. POST /api/v1/task cria a task (devolve task_id)
 *  2. Poll GET /api/v1/task/{task_id} ate status=completed (geralmente 30-60s)
 *  3. Retorna audio_url da(s) variacao(oes)
 */

const BASE = "https://api.piapi.ai/api/v1";

function apiKey(): string {
  const k = process.env.PIAPI_KEY;
  if (!k) throw new Error("PIAPI_KEY ausente");
  return k;
}

export interface SunoResult {
  audio_url: string;
  audio_url_2?: string;
  title?: string;
  duration?: number;
  lyrics?: string;
}

/** Cria task Suno e faz poll ate completar. */
export async function gerarMusicaSuno(opts: {
  prompt: string;                      // descricao estilo/mood em ingles
  make_instrumental?: boolean;
  title?: string;
  lyrics?: string;                     // opcional, letra custom
  max_polls?: number;                  // default 40 = ~2min
}): Promise<SunoResult> {
  const key = apiKey();

  // 1. cria task
  const body = {
    model: "music-u",
    task_type: "generate_music",
    input: {
      gpt_description_prompt: opts.prompt,
      make_instrumental: opts.make_instrumental ?? false,
      lyrics_type: opts.lyrics ? "user" : "generate",
      prompt: opts.lyrics || undefined,
      title: opts.title || undefined,
    },
  };

  const createRes = await fetch(`${BASE}/task`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`PiAPI create ${createRes.status}: ${txt.slice(0, 300)}`);
  }
  const created = await createRes.json();
  const taskId = created.data?.task_id || created.task_id;
  if (!taskId) throw new Error("PiAPI nao devolveu task_id");

  // 2. poll ate completar
  const maxPolls = opts.max_polls || 40;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 3000));   // 3s entre polls
    const statusRes = await fetch(`${BASE}/task/${taskId}`, {
      headers: { "x-api-key": key },
    });
    if (!statusRes.ok) continue;
    const status = await statusRes.json();
    const taskData = status.data || status;
    const state = taskData.status;

    if (state === "completed" || state === "success") {
      const output = taskData.output || {};
      const clips = output.clips || output.data || [];
      const first = Array.isArray(clips) ? clips[0] : null;
      if (!first?.audio_url) throw new Error("PiAPI completou sem audio_url");
      return {
        audio_url: first.audio_url,
        audio_url_2: Array.isArray(clips) && clips[1]?.audio_url,
        title: first.title,
        duration: first.duration,
        lyrics: first.lyric || first.metadata?.prompt,
      };
    }
    if (state === "failed" || state === "error") {
      throw new Error(`PiAPI task falhou: ${taskData.error?.message || "erro"}`);
    }
  }
  throw new Error("PiAPI timeout — musica demorou mais de 2min");
}
