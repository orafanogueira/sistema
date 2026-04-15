import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";
import { gerarMusicaSuno } from "@/lib/youtube/suno-api";

export const maxDuration = 300;

const PROMPT_OTIMIZADOR = `Voce e especialista em prompts de Suno AI (geracao de musica). Converte o pedido do usuario em um prompt OTIMIZADO em ingles seguindo o estilo Suno.

REGRAS:
- EM INGLES, sempre
- Mencionar: genero, mood, instrumentos, tempo/BPM, estrutura
- Ser especifico (nao "happy music" mas "uplifting pop, 128 BPM, acoustic guitar + soft piano + gentle vocals")
- Adicionar tags de qualidade: "high quality, studio recording"
- Maximo 500 caracteres
- Se for instrumental, mencionar "instrumental" no inicio
- Se for pra video dark/YouTube, pensar em tracks cinematicas

Output: APENAS o prompt final, sem explicacao, sem aspas.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { descricao, tipo, instrumental, titulo, letra } = await req.json();
  if (!descricao?.trim()) return new NextResponse("descricao obrigatoria", { status: 400 });

  // 1. Claude otimiza o prompt pro Suno
  let promptSuno = "";
  try {
    promptSuno = await aiChat({
      systemPrompt: PROMPT_OTIMIZADOR,
      messages: [{ role: "user", content: `Pedido: ${descricao}\nTipo: ${tipo || "background"}\nInstrumental: ${instrumental ? "sim" : "nao"}` }],
      temperature: 0.7,
      maxTokens: 400,
    });
    promptSuno = promptSuno.trim().replace(/^["']|["']$/g, "").slice(0, 500);
  } catch (e) {
    promptSuno = descricao;   // fallback: usa direto
  }

  // 2. Chama Suno via PiAPI
  let result;
  try {
    result = await gerarMusicaSuno({
      prompt: promptSuno,
      make_instrumental: instrumental ?? true,
      title: titulo,
      lyrics: letra,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro Suno", { status: 500 });
  }

  // 3. Baixa audio e salva no Storage
  const audioRes = await fetch(result.audio_url);
  if (!audioRes.ok) return new NextResponse("Nao conseguiu baixar audio do Suno", { status: 500 });
  const buffer = Buffer.from(await audioRes.arrayBuffer());
  const path = `${m.tenant_id}/trilha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`;
  const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, {
    contentType: "audio/mpeg", upsert: false,
  });
  if (upErr) return new NextResponse(`Storage: ${upErr.message}`, { status: 400 });
  const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);

  const { data: row } = await supabase.from("youtube_trilhas").insert({
    tenant_id: m.tenant_id,
    tipo: tipo || "background",
    prompt_descricao: descricao,
    prompt_suno: promptSuno,
    letra: letra || null,
    instrumental: instrumental ?? true,
    titulo_variacao: result.title,
    duracao_sec: result.duration,
    url: pub.publicUrl,
    storage_path: path,
    url_variacao_2: result.audio_url_2,
    created_by: user.id,
  }).select().single();

  return NextResponse.json({
    trilha: row,
    url: pub.publicUrl,
    url_variacao_2: result.audio_url_2,
    prompt_suno: promptSuno,
    duracao: result.duration,
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("youtube_trilhas")
    .select("*").order("created_at", { ascending: false }).limit(30);
  return NextResponse.json(data || []);
}
