import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { invite_link, numero_id }: { invite_link: string; numero_id?: string } = await req.json();
  if (!invite_link) return new NextResponse("invite_link obrigatório", { status: 400 });

  const codeMatch = invite_link.match(/chat\.whatsapp\.com\/([\w-]+)/);
  const inviteCode = codeMatch ? codeMatch[1] : invite_link.replace(/.*\//, "").trim();
  if (!inviteCode || inviteCode.length < 10) {
    return new NextResponse("código de convite inválido", { status: 400 });
  }

  let numero;
  if (numero_id) {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("id,zapi_instance_id,zapi_token").eq("id", numero_id).maybeSingle();
    numero = data;
  } else {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("id,zapi_instance_id,zapi_token").eq("is_active", true).limit(1).maybeSingle();
    numero = data;
  }

  if (!numero?.zapi_instance_id || !numero?.zapi_token) {
    return new NextResponse("número Z-API não configurado", { status: 400 });
  }

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}`;
  const headers = { "Content-Type": "application/json", "Client-Token": clientToken };

  try {
    // pega metadata do convite
    const metaRes = await fetch(`${zapiBase}/invite-metadata/${inviteCode}`, { headers });
    if (!metaRes.ok) {
      return NextResponse.json({ erro: `invite-metadata ${metaRes.status}` }, { status: 400 });
    }
    const meta = await metaRes.json();
    const groupName = meta.name || meta.subject || "Grupo";

    // entra no grupo
    const joinRes = await fetch(`${zapiBase}/groups/join-by-invite-code`, {
      method: "POST",
      headers,
      body: JSON.stringify({ inviteCode }),
    });

    if (joinRes.ok) {
      return NextResponse.json({ ok: true, ja_era_participante: false, group_name: groupName });
    }
    if (joinRes.status === 403 || joinRes.status === 400) {
      return NextResponse.json({ ok: true, ja_era_participante: true, group_name: groupName });
    }

    const txt = await joinRes.text();
    return NextResponse.json({ erro: `join ${joinRes.status}: ${txt.slice(0, 200)}` }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "erro" }, { status: 500 });
  }
}
