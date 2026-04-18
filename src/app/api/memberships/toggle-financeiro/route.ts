import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  // só owner pode togglear
  const { data: myMembership } = await supabase.from("memberships")
    .select("role").eq("user_id", user.id).maybeSingle();
  if (myMembership?.role !== "owner") return new NextResponse("só owner pode alterar", { status: 403 });

  const { membership_id, value } = await req.json();
  if (!membership_id) return new NextResponse("membership_id obrigatório", { status: 400 });

  // service client puro (bypass RLS)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return new NextResponse("env vars ausentes", { status: 500 });

  const service = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error, count } = await service.from("memberships")
    .update({ can_see_financeiro: !!value })
    .eq("id", membership_id)
    .select();

  if (error) return new NextResponse(`DB: ${error.message}`, { status: 400 });

  return NextResponse.json({ ok: true, can_see_financeiro: !!value, rows_updated: count });
}
