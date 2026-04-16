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

  const body: Record<string, unknown> = custom
    ? { custom_mode: true, prompt: letra || promptSuno, title: titulo || "Untitled", tags, make_instrumental: instrumental ?? false, mv: "chirp-v3-5" }
    : { custom_mode: false, gpt_description_prompt: promptSuno, make_instrumental: instrumental ?? true, mv: "chirp-v3-5" };

  const createRes = await fetch("https://api.sunoapi.com/api/v1/suno/create", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    return new NextResponse(`SunoAPI create ${createRes.status}: ${txt.slice(0, 300)}`, { status: 500 });
  }
  const created = await createRes.json();
  const data = created.data ?? created;
  type ClipShape = { id?: string };
  const taskId: string =
    data.task_id || data.taskId || created.task_id ||
    (Array.isArray(data.clips) ? data.clips.map((c: ClipShape) => c.id).filter(Boolean).join(",") : "") ||
    (Array.isArray(data.clip_ids) ? data.clip_ids.join(",") : "") ||
    data.id || "";

  if (!taskId) {
    return new NextResponse(`SunoAPI sem task_id. Raw: ${JSON.stringify(created).slice(0, 400)}`, { status: 500 });
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

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("youtube_trilhas")
    .select("*")
    .neq("url", "pending")
    .order("created_at", { ascending: false }).limit(30);
  return NextResponse.json(data || []);
}
