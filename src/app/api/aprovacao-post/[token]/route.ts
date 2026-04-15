import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Endpoint publico - cliente aprova/rejeita post via link. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase.from("social_posts")
    .select("*,cliente:clientes(nome)")
    .eq("aprovacao_token", token).maybeSingle();
  if (!data) return new NextResponse("token invalido", { status: 404 });
  const { data: revisoes } = await supabase.from("social_post_revisoes")
    .select("*").eq("post_id", data.id).order("created_at", { ascending: false });
  return NextResponse.json({ post: data, revisoes: revisoes || [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const body = await req.json();    // { action: 'approve'|'reject'|'comment', content?: '...' }

  const { data: post } = await supabase.from("social_posts")
    .select("id,cliente_id").eq("aprovacao_token", token).maybeSingle();
  if (!post) return new NextResponse("token invalido", { status: 404 });

  if (body.action === "approve") {
    await supabase.from("social_posts").update({
      status: "aprovado", cliente_aprovou: true, cliente_aprovou_at: new Date().toISOString(),
    }).eq("id", post.id);
  } else if (body.action === "reject") {
    await supabase.from("social_posts").update({ status: "rejeitado" }).eq("id", post.id);
  }

  await supabase.from("social_post_revisoes").insert({
    post_id: post.id, author: "cliente",
    type: body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : "comment",
    content: body.content || null,
  });

  return NextResponse.json({ ok: true });
}
