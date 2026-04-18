import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * Upload de vídeo pro YouTube via YouTube Data API v3.
 *
 * Requer OAuth2 access_token do canal do usuário.
 * Token salvo em integrations (provider=youtube, cliente_id ou tenant-level).
 *
 * Input: { video_url, title, description, tags, category_id, privacy, scheduled_at }
 * Output: { youtube_video_id, youtube_url }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { video_url, title, description, tags, category_id, privacy, scheduled_at } = await req.json();
  if (!video_url || !title) return new NextResponse("video_url e title obrigatórios", { status: 400 });

  // busca token OAuth do YouTube (salvo em integrations)
  const { data: integ } = await supabase.from("integrations")
    .select("access_token,refresh_token,extra")
    .eq("provider", "youtube").eq("is_connected", true)
    .limit(1).maybeSingle();

  if (!integ?.access_token) {
    return new NextResponse("Canal YouTube não conectado. Vá em Configurações → Conectar YouTube.", { status: 400 });
  }

  try {
    // 1. Baixa o vídeo
    const videoRes = await fetch(video_url);
    if (!videoRes.ok) throw new Error(`Não conseguiu baixar vídeo: ${videoRes.status}`);
    const videoBuffer = await videoRes.arrayBuffer();
    const videoSize = videoBuffer.byteLength;

    // 2. Inicia upload resumable no YouTube
    const metadata = {
      snippet: {
        title,
        description: description || "",
        tags: Array.isArray(tags) ? tags : (tags || "").split(",").map((t: string) => t.trim()).filter(Boolean),
        categoryId: category_id || "22", // 22 = People & Blogs
      },
      status: {
        privacyStatus: privacy || "private", // private, unlisted, public
        ...(scheduled_at ? {
          publishAt: new Date(scheduled_at).toISOString(),
          privacyStatus: "private", // scheduling requires private first
        } : {}),
      },
    };

    const initRes = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${integ.access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(videoSize),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const txt = await initRes.text();
      // se 401, token expirou
      if (initRes.status === 401) {
        return new NextResponse("Token YouTube expirou. Reconecte em Configurações.", { status: 401 });
      }
      return new NextResponse(`YouTube init ${initRes.status}: ${txt.slice(0, 300)}`, { status: 500 });
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube não retornou upload URL");

    // 3. Faz upload do vídeo
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoSize),
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      return new NextResponse(`YouTube upload ${uploadRes.status}: ${txt.slice(0, 300)}`, { status: 500 });
    }

    const uploadData = await uploadRes.json();
    const videoId = uploadData.id;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    return NextResponse.json({
      youtube_video_id: videoId,
      youtube_url: youtubeUrl,
      privacy: metadata.status.privacyStatus,
      scheduled_at: scheduled_at || null,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro upload", { status: 500 });
  }
}
