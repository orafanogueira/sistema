import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { board_id, column_id, title, description, priority, due_date, tags, assignee_id, cliente_id } = await req.json();
  if (!board_id || !column_id || !title) return new NextResponse("board_id, column_id, title obrigatorios", { status: 400 });

  // proxima posicao na coluna
  const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true }).eq("column_id", column_id);

  const { data, error } = await supabase.from("tasks").insert({
    tenant_id: m.tenant_id,
    board_id,
    column_id,
    title,
    description: description || null,
    priority: priority || "normal",
    due_date: due_date || null,
    tags: Array.isArray(tags) ? tags : [],
    assignee_id: assignee_id || null,
    cliente_id: cliente_id || null,
    position: count || 0,
    created_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
