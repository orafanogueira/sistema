import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { numero_id }: { numero_id?: string } = await req.json().catch(() => ({}));

  let numero;
  if (numero_id) {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("id,nome,telefone,zapi_instance_id,zapi_token")
      .eq("id", numero_id).maybeSingle();
    numero = data;
  } else {
    const { data } = await supabase.from("whatsapp_numeros")
      .select("id,nome,telefone,zapi_instance_id,zapi_token")
      .eq("is_active", true).limit(1).maybeSingle();
    numero = data;
  }

  if (!numero?.zapi_instance_id || !numero?.zapi_token) {
    return new NextResponse("número Z-API não configurado", { status: 400 });
  }

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}`;

  try {
    // Z-API: GET /chats - lista todos os chats incluindo grupos
    // paginamos até pegar todos os grupos
    const grupos: Array<Record<string, unknown>> = [];
    let page = 1;
    const pageSize = 100;

    while (page <= 10) {
      const r = await fetch(`${zapiBase}/chats?page=${page}&pageSize=${pageSize}`, {
        headers: { "Client-Token": clientToken },
      });
      if (!r.ok) {
        if (page === 1) {
          const txt = await r.text();
          return NextResponse.json({ erro: `Z-API ${r.status}: ${txt.slice(0, 200)}`, grupos: [] });
        }
        break;
      }
      const chats = (await r.json()) as Array<Record<string, unknown>>;
      if (!Array.isArray(chats) || chats.length === 0) break;

      // filtra só grupos
      for (const chat of chats) {
        if (chat.isGroup) {
          grupos.push({
            id: chat.phone,
            nome: chat.name,
            imagem: chat.imageUrl || null,
            last_message_time: chat.lastMessageTime,
            unread: chat.unread,
          });
        }
      }

      if (chats.length < pageSize) break;
      page++;
    }

    return NextResponse.json({
      grupos,
      total: grupos.length,
      numero: { id: numero.id, nome: numero.nome, telefone: numero.telefone },
    });
  } catch (e: unknown) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "erro", grupos: [] });
  }
}
