import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: post }, { data: revisoes }] = await Promise.all([
    supabase.from("social_posts").select("*,cliente:clientes(nome,contato_email)").eq("id", id).maybeSingle(),
    supabase.from("social_post_revisoes").select("*").eq("post_id", id).order("created_at", { ascending: false }),
  ]);
  if (!post) return new NextResponse("nao encontrado", { status: 404 });
  return NextResponse.json({ post, revisoes: revisoes || [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from("social_posts").update(body).eq("id", id).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  // se o update mudou status, registra revisao
  if (body.status) {
    const user = (await supabase.auth.getUser()).data.user;
    await supabase.from("social_post_revisoes").insert({
      post_id: id, author: user?.email || "sistema",
      type: body.status === "aprovado" ? "approve" : body.status === "rejeitado" ? "reject" : "comment",
      content: `Status alterado pra ${body.status}`,
    });
  }
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("social_posts").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
