import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { igSubscribePageWebhooks } from "@/lib/instagram/graph-api";

/**
 * Conecta uma conta Instagram Business ao cliente.
 * Recebe: ig_user_id, ig_username, fb_page_id, page_access_token
 * (no futuro, via OAuth Meta. Por enquanto, manual.)
 *
 * Apos conectar, assina webhooks automaticamente.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { cliente_id, ig_user_id, ig_username, fb_page_id, page_access_token } = body;

  if (!ig_user_id || !page_access_token) {
    return new NextResponse("ig_user_id e page_access_token obrigatorios", { status: 400 });
  }

  const { data: existing } = await supabase.from("instagram_accounts")
    .select("id").eq("ig_user_id", ig_user_id).maybeSingle();

  let subscribed = false;
  try {
    if (fb_page_id) {
      await igSubscribePageWebhooks({ page_id: fb_page_id, page_access_token });
      subscribed = true;
    }
  } catch (e) {
    console.log("falha ao subscrever webhook:", e);
  }

  const payload = {
    tenant_id: m.tenant_id,
    cliente_id: cliente_id || null,
    ig_user_id,
    ig_username,
    fb_page_id,
    page_access_token,
    webhook_subscribed: subscribed,
    is_active: true,
    last_sync_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase.from("instagram_accounts").update(payload).eq("id", existing.id).select().single();
    if (error) return new NextResponse(error.message, { status: 400 });
    return NextResponse.json(data);
  } else {
    const { data, error } = await supabase.from("instagram_accounts").insert(payload).select().single();
    if (error) return new NextResponse(error.message, { status: 400 });
    return NextResponse.json(data);
  }
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("instagram_accounts").select("*,cliente:clientes(nome)").order("created_at");
  if (cliente_id) q = q.eq("cliente_id", cliente_id);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
