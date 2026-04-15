import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("ig_automacoes")
    .select("*,cliente:clientes(nome),ig_account:instagram_accounts(ig_username)")
    .order("created_at", { ascending: false });
  if (cliente_id) q = q.eq("cliente_id", cliente_id);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { data, error } = await supabase.from("ig_automacoes").insert({
    tenant_id: m.tenant_id,
    cliente_id: body.cliente_id,
    ig_account_id: body.ig_account_id,
    name: body.name,
    trigger: body.trigger || "comment_on_post",
    post_ids: body.post_ids || [],
    keywords: body.keywords || [],
    keyword_match_mode: body.keyword_match_mode || "any",
    case_sensitive: body.case_sensitive || false,
    response_text: body.response_text,
    send_public_reply: body.send_public_reply || false,
    public_reply_text: body.public_reply_text,
    only_followers: body.only_followers || false,
    one_per_user: body.one_per_user ?? true,
    ai_takes_over: body.ai_takes_over || false,
    ai_agent_id: body.ai_agent_id || null,
    create_lead: body.create_lead ?? true,
    tags: body.tags || [],
    is_active: body.is_active ?? true,
  }).select().single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
