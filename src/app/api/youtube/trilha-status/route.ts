import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/youtube/trilha/status?id=xxx
 * Checa status da trilha no SunoAPI. Se completou, baixa audio e salva no Storage.
 * Frontend faz polling a cada 5s.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatorio", { status: 400 });

  const { data: trilha } = await supabase.from("youtube_trilhas").select("*").eq("id", id).maybeSingle();
  if (!trilha) return new NextResponse("trilha nao encontrada", { status: 404 });

  // se ja tem url, ta pronta
  if (trilha.url && trilha.url !== "pending") {
    return NextResponse.json({ status: "complete", trilha });
  }

  // se nao tem task_id, nao da pra checar
  if (!trilha.task_id) return NextResponse.json({ status: "waiting", message: "sem task_id" });

  // checa no SunoAPI
  const key = process.env.SUNOAPI_KEY || process.env.SUNO_API_KEY;
  if (!key) return NextResponse.json({ status: "error", message: "SUNOAPI_KEY ausente" });

  const clipIds = trilha.task_id.split(",").filter(Boolean);
  const pollUrl = clipIds.length > 0
    ? `https://api.sunoapi.com/api/v1/suno/clips?ids=${clipIds.join(",")}`
    : `https://api.sunoapi.com/api/v1/suno/task/${trilha.task_id}`;

  try {
    const r = await fetch(pollUrl, { headers: { "Authorization": `Bearer ${key}` } });
    if (!r.ok) return NextResponse.json({ status: "polling", message: `suno ${r.status}` });

    const statusData = await r.json();
    const payload = statusData.data || statusData;
    const rawPreview = JSON.stringify(statusData).slice(0, 400);

    type Clip = { status?: string; audio_url?: string; title?: string; duration?: number; metadata?: { duration?: number } };
    let clips: Clip[] = Array.isArray(payload) ? payload
      : Array.isArray(payload.clips) ? payload.clips
      : payload.audio_url ? [payload as Clip]
      : [];

    // formato alternativo: payload e um objeto com status+audio_url diretamente
    if (clips.length === 0 && payload.status && payload.audio_url) {
      clips = [payload as Clip];
    }

    if (clips.length === 0) return NextResponse.json({ status: "polling", message: `raw: ${rawPreview}` });

    const completos = clips.filter((c) => (c.status === "complete" || c.status === "streaming") && c.audio_url);
    if (completos.length === 0) {
      const failed = clips.find((c) => c.status === "error" || c.status === "failed");
      if (failed) return NextResponse.json({ status: "error", message: "Suno falhou na geracao" });
      return NextResponse.json({ status: "polling", message: `aguardando (${clips[0]?.status || "?"})` });
    }

    // completou! baixa audio e salva no Storage
    const first = completos[0];
    const audioRes = await fetch(first.audio_url!);
    if (!audioRes.ok) return NextResponse.json({ status: "error", message: "nao baixou audio" });
    const buffer = Buffer.from(await audioRes.arrayBuffer());

    const { data: { user } } = await supabase.auth.getUser();
    const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user!.id).maybeSingle();
    const path = `${m?.tenant_id || "unknown"}/trilha-${Date.now()}.mp3`;

    const { error: upErr } = await supabase.storage.from("social-media").upload(path, buffer, {
      contentType: "audio/mpeg", upsert: false,
    });
    if (upErr) return NextResponse.json({ status: "error", message: `Storage: ${upErr.message}` });
    const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);

    // atualiza trilha no DB
    await supabase.from("youtube_trilhas").update({
      url: pub.publicUrl,
      titulo_variacao: first.title || trilha.titulo_variacao,
      duracao_sec: first.duration,
      url_variacao_2: completos[1]?.audio_url || null,
    }).eq("id", id);

    const updated = { ...trilha, url: pub.publicUrl, duracao_sec: first.duration, url_variacao_2: completos[1]?.audio_url };
    return NextResponse.json({ status: "complete", trilha: updated });
  } catch (e: unknown) {
    return NextResponse.json({ status: "error", message: e instanceof Error ? e.message : "erro" });
  }
}
