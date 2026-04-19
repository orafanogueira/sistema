import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

interface Participante {
  phone: string;
  nome?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { invite_link, numero_id, extrair_sem_entrar }: {
    invite_link: string;
    numero_id?: string;
    extrair_sem_entrar?: boolean;
  } = await req.json();

  if (!invite_link) return new NextResponse("invite_link obrigatório", { status: 400 });

  // extrai o código do link (chat.whatsapp.com/XXXXX)
  const codeMatch = invite_link.match(/chat\.whatsapp\.com\/([\w-]+)/);
  const inviteCode = codeMatch ? codeMatch[1] : invite_link.replace(/.*\//, "").trim();

  if (!inviteCode || inviteCode.length < 10) {
    return new NextResponse("código de convite inválido", { status: 400 });
  }

  // busca número Z-API ativo
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
    return new NextResponse("nenhum número Z-API configurado", { status: 400 });
  }

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}`;
  const headers = { "Content-Type": "application/json", "Client-Token": clientToken };

  try {
    // 1) pega metadata do convite (não entra ainda)
    const metaRes = await fetch(`${zapiBase}/invite-metadata/${inviteCode}`, { headers });
    if (!metaRes.ok) {
      const txt = await metaRes.text();
      return NextResponse.json({
        erro: `invite-metadata ${metaRes.status}: ${txt.slice(0, 200)}`,
      }, { status: 400 });
    }

    const meta = await metaRes.json();
    const groupPhone = meta.phone || meta.id || meta.chatId || meta.groupId;
    const groupName = meta.name || meta.subject || "Grupo";

    if (!groupPhone) {
      return NextResponse.json({
        erro: "Não consegui identificar o ID do grupo pelo convite",
        meta,
      }, { status: 400 });
    }

    let jaEraParticipante = false;

    // 2) entra no grupo (se ainda não é participante)
    if (!extrair_sem_entrar) {
      const joinRes = await fetch(`${zapiBase}/groups/join-by-invite-code`, {
        method: "POST",
        headers,
        body: JSON.stringify({ inviteCode }),
      });

      if (!joinRes.ok) {
        const txt = await joinRes.text();
        // 403/400 normalmente = já é participante, continua mesmo assim
        if (joinRes.status === 403 || joinRes.status === 400) {
          jaEraParticipante = true;
        } else {
          return NextResponse.json({
            erro: `join ${joinRes.status}: ${txt.slice(0, 200)}`,
            meta,
          }, { status: 400 });
        }
      }

      // aguarda Z-API sincronizar
      await new Promise((r) => setTimeout(r, 4000));
    }

    // 3) pega metadata do grupo (com participantes)
    const groupRes = await fetch(`${zapiBase}/group-metadata/${groupPhone}`, { headers });
    if (!groupRes.ok) {
      const txt = await groupRes.text();
      return NextResponse.json({
        erro: `group-metadata ${groupRes.status}: ${txt.slice(0, 200)}`,
        group_phone: groupPhone,
        group_name: groupName,
      }, { status: 400 });
    }

    const group = await groupRes.json();
    const participants = (group.participants || group.phoneParticipants || []) as Array<Record<string, unknown>>;

    // normaliza: pega só phone, nome e flags
    const contatos: Participante[] = participants.map((p) => {
      const phone = String(p.phone || p.id || "").replace(/@.*$/, "");
      const nome = (p.pushname as string) || (p.name as string) || (p.short as string) || undefined;
      return {
        phone,
        nome,
        isAdmin: Boolean(p.isAdmin),
        isSuperAdmin: Boolean(p.isSuperAdmin),
      };
    }).filter((p) => p.phone && p.phone.length >= 10);

    return NextResponse.json({
      group_id: groupPhone,
      group_name: groupName,
      total_contatos: contatos.length,
      contatos,
      ja_era_participante: jaEraParticipante,
      invite_code: inviteCode,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      erro: e instanceof Error ? e.message : "erro",
    }, { status: 500 });
  }
}
