import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

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

  // usa service client pra bypass RLS
  const service = createServiceClient();
  const { error } = await service.from("memberships")
    .update({ can_see_financeiro: !!value })
    .eq("id", membership_id);
  if (error) return new NextResponse(error.message, { status: 400 });

  return NextResponse.json({ ok: true, can_see_financeiro: !!value });
}
