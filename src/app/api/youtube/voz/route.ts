import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listVoices, textToSpeech, VOZES_RECOMENDADAS_PT, getUserInfo } from "@/lib/youtube/elevenlabs";

export const maxDuration = 300;   // ate 5min pra textos longos com chunking

const MAX_CHARS_TOTAL = 80000;
const CHUNK_SIZE = 4500;          // seguro dentro do limit de 5000 por request

/** Quebra texto em chunks em final de frase (ponto, exclamacao, interrogacao). */
function chunkText(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    // procura pela ultima quebra de frase antes do limite
    const slice = remaining.slice(0, maxSize);
    const lastBoundary = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf(".\n"),
      slice.lastIndexOf("!\n"),
      slice.lastIndexOf("?\n"),
    );

    const cut = lastBoundary > maxSize * 0.5 ? lastBoundary + 1 : maxSize;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  return chunks;
}

/** GET: lista vozes disponiveis + curadoria pt-BR */
export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({
      voices,
      curadas: VOZES_RECOMENDADAS_PT,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}

/** POST: gera audio a partir de texto + voice_id e salva no Storage */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { text, voice_id, voice_name, stability, similarity_boost, style } = await req.json();
  if (!text?.trim() || !voice_id) return new NextResponse("text e voice_id obrigatorios", { status: 400 });

  if (text.length > MAX_CHARS_TOTAL) {
    return new NextResponse(`Texto max ${MAX_CHARS_TOTAL.toLocaleString()} chars (voce enviou ${text.length.toLocaleString()})`, { status: 400 });
  }

  try {
    // quebra em chunks seguros (ate 4500 chars cada, em quebra de frase)
    const chunks = chunkText(text, CHUNK_SIZE);

    // gera TTS de cada chunk em sequencia (paralelizar pode estourar rate limit do ElevenLabs)
    const buffers: Buffer[] = [];
    let totalChars = 0;
    for (let i = 0; i < chunks.length; i++) {
      const { buffer, chars } = await textToSpeech({
        text: chunks[i],
        voice_id,
        stability: stability ?? 0.5,
        similarity_boost: similarity_boost ?? 0.75,
        style: style ?? 0,
      });
      buffers.push(buffer);
      totalChars += chars;
    }

    // MP3 frames sao auto-contidos — concatenar buffers funciona
    const combined = Buffer.concat(buffers);

    const path = `${m.tenant_id}/audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`;
    const { error: upErr } = await supabase.storage.from("social-media").upload(path, combined, {
      contentType: "audio/mpeg", upsert: false,
    });
    if (upErr) return new NextResponse(`Storage: ${upErr.message}`, { status: 400 });

    const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);

    const { data: audio } = await supabase.from("youtube_audios").insert({
      tenant_id: m.tenant_id,
      texto: text.slice(0, 20000),
      voice_id, voice_name: voice_name || voice_id,
      url: pub.publicUrl, storage_path: path,
      characters_used: totalChars,
      created_by: user.id,
    }).select().single();

    return NextResponse.json({
      audio, url: pub.publicUrl, chars: totalChars,
      chunks_processados: chunks.length,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
