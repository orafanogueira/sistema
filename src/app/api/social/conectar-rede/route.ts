import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { cliente_id, provider, account_id, account_name, access_token } = await req.json();
  if (!cliente_id || !provider) return new NextResponse("cliente_id e provider obrigatórios", { status: 400 });

  // upsert: se já existe pra esse cliente+provider, atualiza
  const { data: existing } = await supabase.from("integrations")
    .select("id").eq("cliente_id", cliente_id).eq("provider", provider).maybeSingle();

  if (existing) {
    await supabase.from("integrations").update({
      account_id: account_id || null,
      account_name: account_name || null,
      access_token: access_token || null,
      is_connected: true,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabase.from("integrations").insert({
      tenant_id: m.tenant_id,
      cliente_id,
      provider,
      account_id: account_id || null,
      account_name: account_name || null,
      access_token: access_token || null,
      is_connected: true,
    });
  }

  return NextResponse.json({ ok: true });
}
