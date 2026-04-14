import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

/**
 * Cria tenant + profile + membership owner no primeiro login do usuario.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { fullName, agencia, email } = await req.json();
  const service = await createServiceClient();

  await service.from("profiles").upsert({ id: user.id, email, full_name: fullName }, { onConflict: "id" });

  // ja tem membership?
  const { data: existing } = await service.from("memberships").select("id").eq("user_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, existed: true });

  const slug = slugify(agencia || fullName) + "-" + Math.random().toString(36).slice(2, 6);
  const { data: tenant, error: terr } = await service.from("tenants").insert({ slug, name: agencia || fullName }).select().single();
  if (terr) return new NextResponse(terr.message, { status: 400 });

  await service.from("memberships").insert({ tenant_id: tenant.id, user_id: user.id, role: "owner", team: "admin" });

  return NextResponse.json({ ok: true, tenantId: tenant.id });
}
