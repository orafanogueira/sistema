import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE = 15 * 1024 * 1024;      // 15MB
const MAX_VIDEO = 200 * 1024 * 1024;     // 200MB

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const cliente_id = formData.get("cliente_id") as string | null;
  const post_id = formData.get("post_id") as string | null;
  const position = Number(formData.get("position") || 0);

  if (!file) return new NextResponse("file obrigatorio", { status: 400 });

  const isVideo = file.type.startsWith("video/");
  const maxSize = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (file.size > maxSize) {
    return new NextResponse(`Arquivo muito grande. Max: ${maxSize / 1024 / 1024}MB`, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${m.tenant_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from("social-media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return new NextResponse(`Upload: ${upErr.message}`, { status: 400 });

  const { data: pub } = supabase.storage.from("social-media").getPublicUrl(path);

  const { data: asset, error: aErr } = await supabase.from("social_media_assets").insert({
    tenant_id: m.tenant_id,
    cliente_id: cliente_id || null,
    post_id: post_id || null,
    url: pub.publicUrl,
    storage_path: path,
    tipo: isVideo ? "video" : (file.type === "image/gif" ? "gif" : "imagem"),
    mime_type: file.type,
    size_bytes: file.size,
    position,
    created_by: user.id,
  }).select().single();
  if (aErr) return new NextResponse(aErr.message, { status: 400 });

  return NextResponse.json(asset);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new NextResponse("id obrigatorio", { status: 400 });

  const { data: asset } = await supabase.from("social_media_assets").select("storage_path").eq("id", id).maybeSingle();
  if (asset?.storage_path) {
    await supabase.storage.from("social-media").remove([asset.storage_path]);
  }
  await supabase.from("social_media_assets").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
