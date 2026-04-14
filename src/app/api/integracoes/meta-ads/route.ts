import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MetaAdsClient } from "@/lib/integrations/meta-ads";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data: membership } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!membership) return new NextResponse("sem tenant", { status: 400 });

  const { cliente_id, account_id, access_token } = await req.json();

  const token = access_token || process.env.META_ACCESS_TOKEN;
  if (!token) return new NextResponse("sem access_token", { status: 400 });
  const client = new MetaAdsClient(token, account_id);
  let accountInfo;
  try { accountInfo = await client.account(); }
  catch (e: unknown) { return new NextResponse("nao foi possivel validar: " + (e instanceof Error ? e.message : ""), { status: 400 }); }

  const { data, error } = await supabase
    .from("integrations")
    .upsert({
      tenant_id: membership.tenant_id,
      cliente_id: cliente_id || null,
      provider: "meta_ads",
      account_id,
      account_name: accountInfo.name,
      access_token: access_token || null,
      is_connected: true,
      last_sync_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,cliente_id,provider" })
    .select().single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}
