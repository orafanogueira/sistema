import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_COLUMNS = [
  { name: "A fazer", color: "#64748b", position: 0 },
  { name: "Em andamento", color: "#06b6d4", position: 1 },
  { name: "Revisao", color: "#f59e0b", position: 2 },
  { name: "Concluido", color: "#10b981", position: 3 },
];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { name, scope, team, cliente_id, columns } = await req.json();
  if (!name) return new NextResponse("name obrigatorio", { status: 400 });

  const { data: board, error } = await supabase.from("boards").insert({
    tenant_id: m.tenant_id,
    cliente_id: cliente_id || null,
    name,
    scope: scope || "tenant",
    team: team || null,
    created_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  const cols = Array.isArray(columns) && columns.length ? columns : DEFAULT_COLUMNS;
  const { error: colsError } = await supabase.from("board_columns").insert(
    cols.map((c: { name: string; color?: string; position?: number }, i: number) => ({
      board_id: board.id,
      name: c.name,
      color: c.color || "#64748b",
      position: c.position ?? i,
    }))
  );
  if (colsError) return new NextResponse(colsError.message, { status: 400 });

  return NextResponse.json(board);
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("boards").select("*").order("created_at");
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
