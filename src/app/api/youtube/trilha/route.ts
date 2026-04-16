import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

export const maxDuration = 60;

const PROMPT_OTIMIZADOR = `Voce e especialista em prompts de Suno AI (geracao de musica). Converte o pedido do usuario em um prompt OTIMIZADO em ingles seguindo o estilo Suno.

REGRAS:
- EM INGLES, sempre
- Mencionar: genero, mood, instrumentos, tempo/BPM, estrutura
- Ser especifico (nao "happy music" mas "uplifting pop, 128 BPM, acoustic guitar + soft piano + gentle vocals")
- Adicionar tags de qualidade: "high quality, studio recording"
- MAXIMO 380 caracteres (limite do Suno)
- Se for instrumental, mencionar "instrumental" no inicio
- Se for pra video dark/YouTube, pensar em tracks cinematicas

Output: APENAS o prompt final, sem explicacao, sem aspas.`;

/**
 * POST: cria task no SunoAPI e retorna ID imediatamente (frontend faz polling em /status).
 * Nao espera o Suno terminar — evita timeout do Vercel.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { descricao, tipo, instrumental, titulo, letra } = await req.json();
  if (!descricao?.trim()) return new NextResponse("descricao obrigatoria", { status: 400 });

  // 1. Claude otimiza o prompt
  let promptSuno = "";
  try {
    promptSuno = await aiChat({
      systemPrompt: PROMPT_OTIMIZADOR,
      messages: [{ role: "user", content: `Pedido: ${descricao}\nTipo: ${tipo || "background"}\nInstrumental: ${instrumental ? "sim" : "nao"}` }],
      temperature: 0.7,
      maxTokens: 400,
    });
    promptSuno = promptSuno.trim().replace(/^["']|["']$/g, "").slice(0, 380);
  } catch {
    promptSuno = descricao.slice(0, 380);
  }

  // 2. Cria task no SunoAPI (NAO espera completar)
  const key = process.env.SUNOAPI_KEY || process.env.SUNO_API_KEY;
  if (!key) return new NextResponse("SUNOAPI_KEY ausente", { status: 500 });

  const custom = !!(letra);
  const tags = (promptSuno || descricao).slice(0, 180);

  // AIMusicAPI format: mv obrigatorio, custom_mode define o que enviar
  const model = "sonic-v5";   // melhor qualidade
  const body: Record<string, unknown> = custom
    ? {
        custom_mode: true,
        mv: model,
        title: titulo || "Untitled",
        tags,
        prompt: letra || promptSuno,
        make_instrumental: instrumental ?? false,
      }
    : {
        custom_mode: false,
        mv: model,
        title: titulo || "Trilha",
        tags,
        gpt_description_prompt: promptSuno,
        make_instrumental: instrumental ?? true,
      };

  // AIMusicAPI endpoint oficial
  const createRes = await fetch("https://api.aimusicapi.ai/api/v1/sonic/create", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    return new NextResponse(`AIMusicAPI create ${createRes.status}: ${txt.slice(0, 400)}`, { status: 500 });
  }
  const created = await createRes.json();
  const taskId: string = created.task_id || created.data?.task_id || "";
  if (!taskId) {
    return new NextResponse(`AIMusicAPI sem task_id. Raw: ${JSON.stringify(created).slice(0, 400)}`, { status: 500 });
  }

  // 3. Salva no DB com url="pending" (status endpoint vai completar depois)
  const { data: row } = await supabase.from("youtube_trilhas").insert({
    tenant_id: m.tenant_id,
    tipo: tipo || "background",
    prompt_descricao: descricao,
    prompt_suno: promptSuno,
    letra: letra || null,
    instrumental: instrumental ?? true,
    titulo_variacao: titulo || null,
    url: "pending",
    storage_path: "pending",
    task_id: taskId,
    created_by: user.id,
  }).select().single();

  // Retorna IMEDIATAMENTE — frontend faz polling em /status?id=xxx
  return NextResponse.json({
    trilha_id: row?.id,
    task_id: taskId,
    prompt_suno: promptSuno,
    status: "polling",
    message: "Suno gerando. Frontend vai fazer polling ate completar.",
  });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const statusId = url.searchParams.get("status_id");

  // se passou status_id, checa status dessa trilha especifica
  if (statusId) {
    const { data: trilha } = await supabase.from("youtube_trilhas").select("*").eq("id", statusId).maybeSingle();
    if (!trilha) return NextResponse.json({ status: "error", message: "trilha nao encontrada" });
    if (trilha.url && trilha.url !== "pending") {
      return NextResponse.json({ status: "complete", trilha });
    }
    if (!trilha.task_id) return NextResponse.json({ status: "waiting", message: "sem task_id" });

    const key = process.env.SUNOAPI_KEY || process.env.SUNO_API_KEY;
    if (!key) return NextResponse.json({ status: "error", message: "SUNOAPI_KEY ausente" });

    const pollUrl = `https://api.aimusicapi.ai/api/v1/sonic/task/${trilha.task_id}`;

    try {
      const r = await fetch(pollUrl, { headers: { "Authorization": `Bearer ${key}` } });
      if (!r.ok) return NextResponse.json({ status: "polling", message: `aimusicapi HTTP ${r.status}` });
      const statusData = await r.json();
      const rawPreview = JSON.stringify(statusData).slice(0, 400);
      // AIMusicAPI formato: { code, message, task_id, data: { state, clips: [{audio_url, title, duration}] } }
      const taskData = statusData.data || statusData;
      const state = taskData.state || taskData.status;

      if (state === "pending" || state === "running") {
        return NextResponse.json({ status: "polling", message: `state=${state}` });
      }
      if (state === "failed") {
        return NextResponse.json({ status: "error", message: `falhou: ${taskData.error || JSON.stringify(taskData).slice(0, 200)}` });
      }
      if (state !== "succeeded" && state !== "complete") {
        return NextResponse.json({ status: "polling", message: `raw: ${rawPreview}` });
      }

      // sucesso — extrai clips
      type Clip = { audio_url?: string; title?: string; duration?: number; id?: string };
      const clips: Clip[] = Array.isArray(taskData.clips) ? taskData.clips
        : Array.isArray(taskData.data) ? taskData.data
        : taskData.audio_url ? [taskData as Clip]
        : [];

      const completos = clips.filter((c) => c.audio_url);
      if (completos.length === 0) {
        return NextResponse.json({ status: "error", message: `sucedeu mas sem audio_url. Raw: ${rawPreview}` });
      }

      const first = completos[0];
      const audioRes = await fetch(first.audio_url!);
      if (!audioRes.ok) return NextResponse.json({ status: "error", message: "nao baixou audio" });
      const buffer = Buffer.from(await audioRes.arrayBuffer());
      const { data: { user } } = await supabase.auth.getUser();
      const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user!.id).maybeSingle();
      const path = `${m?.tenant_id || "unknown"}/trilha-${Date.now()}.mp3`;
      const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, { contentType: "audio/mpeg", upsert: false });
      if (upErr) return NextResponse.json({ status: "error", message: `Storage: ${upErr.message}` });
      const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);
      await supabase.from("youtube_trilhas").update({
        url: pub.publicUrl,
        titulo_variacao: first.title || trilha.titulo_variacao,
        duracao_sec: first.duration,
        url_variacao_2: completos[1]?.audio_url || null,
        storage_path: path,
      }).eq("id", statusId);
      return NextResponse.json({
        status: "complete",
        trilha: { ...trilha, url: pub.publicUrl, duracao_sec: first.duration, url_variacao_2: completos[1]?.audio_url },
      });
    } catch (e: unknown) {
      return NextResponse.json({ status: "error", message: e instanceof Error ? e.message : "erro" });
    }
  }

  // historico default
  const { data } = await supabase.from("youtube_trilhas")
    .select("*")
    .neq("url", "pending")
    .order("created_at", { ascending: false }).limit(30);
  return NextResponse.json(data || []);
}
