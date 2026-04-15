import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listVoices, textToSpeech, VOZES_RECOMENDADAS_PT } from "@/lib/youtube/elevenlabs";

export const maxDuration = 120;

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

  if (text.length > 5000) return new NextResponse("texto max 5000 chars por request", { status: 400 });

  try {
    const { buffer, chars } = await textToSpeech({
      text, voice_id,
      stability: stability ?? 0.5,
      similarity_boost: similarity_boost ?? 0.75,
      style: style ?? 0,
    });

    const path = `${m.tenant_id}/audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`;
    const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, {
      contentType: "audio/mpeg", upsert: false,
    });
    if (upErr) return new NextResponse(`Storage: ${upErr.message}`, { status: 400 });

    const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);

    const { data: audio } = await supabase.from("youtube_audios").insert({
      tenant_id: m.tenant_id,
      texto: text.slice(0, 10000),
      voice_id, voice_name: voice_name || voice_id,
      url: pub.publicUrl, storage_path: path,
      characters_used: chars,
      created_by: user.id,
    }).select().single();

    return NextResponse.json({ audio, url: pub.publicUrl, chars });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro IA", { status: 500 });
  }
}
