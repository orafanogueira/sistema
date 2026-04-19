import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * GET: resolve ID do grupo pelo invite code via Z-API
 * POST: envia mensagem pro grupo de notificações
 */

async function getZapiCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createSupabaseClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase.from("whatsapp_numeros")
    .select("zapi_instance_id,zapi_token").eq("is_active", true).limit(1).maybeSingle();
  return data;
}

export async function GET() {
  const creds = await getZapiCredentials();
  if (!creds) return NextResponse.json({ error: "sem numero Z-API ativo" });

  const inviteCode = process.env.WHATSAPP_GRUPO_NOTIFY || "";
  if (!inviteCode) return NextResponse.json({ error: "WHATSAPP_GRUPO_NOTIFY ausente" });

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";

  // resolve grupo pelo invite code
  const r = await fetch(`https://api.z-api.io/instances/${creds.zapi_instance_id}/token/${creds.zapi_token}/invite-metadata/${inviteCode}`, {
    headers: { "Client-Token": clientToken },
  });

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ error: `Z-API ${r.status}: ${txt.slice(0, 200)}` });
  }

  const data = await r.json();
  return NextResponse.json({
    group_id: data.phone || data.id || data.chatId,
    group_name: data.subject || data.name,
    participants: data.participants?.length || 0,
    raw: data,
  });
}

export async function POST(req: Request) {
  const { message } = await req.json();
  if (!message) return new NextResponse("message obrigatório", { status: 400 });

  const creds = await getZapiCredentials();
  if (!creds) return new NextResponse("sem numero Z-API ativo", { status: 400 });

  const inviteCode = process.env.WHATSAPP_GRUPO_NOTIFY || "";
  if (!inviteCode) return new NextResponse("WHATSAPP_GRUPO_NOTIFY ausente", { status: 400 });

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";

  // primeiro resolve o grupo ID
  const metaRes = await fetch(`https://api.z-api.io/instances/${creds.zapi_instance_id}/token/${creds.zapi_token}/invite-metadata/${inviteCode}`, {
    headers: { "Client-Token": clientToken },
  });

  if (!metaRes.ok) return new NextResponse("nao conseguiu resolver grupo", { status: 500 });
  const meta = await metaRes.json();
  const groupPhone = meta.phone || meta.id || meta.chatId;
  if (!groupPhone) return new NextResponse("grupo sem phone/id", { status: 500 });

  // envia mensagem pro grupo
  const sendRes = await fetch(`https://api.z-api.io/instances/${creds.zapi_instance_id}/token/${creds.zapi_token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    body: JSON.stringify({ phone: groupPhone, message }),
  });

  if (!sendRes.ok) {
    const txt = await sendRes.text();
    return new NextResponse(`Z-API send ${sendRes.status}: ${txt.slice(0, 200)}`, { status: 500 });
  }

  return NextResponse.json({ ok: true, group: groupPhone });
}
