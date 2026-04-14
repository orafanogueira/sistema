import { NextResponse } from "next/server";
import { verifyMetaWebhook, sendMessenger, sendInstagramDM, sendWhatsAppCloud } from "@/lib/integrations/meta-messaging";
import { createServiceClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";

/** GET - verify webhook */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const res = verifyMetaWebhook(
    url.searchParams.get("hub.mode"),
    url.searchParams.get("hub.verify_token"),
    url.searchParams.get("hub.challenge")
  );
  return res ? new NextResponse(res) : new NextResponse("forbidden", { status: 403 });
}

/** POST - handle mensagens recebidas */
export async function POST(req: Request) {
  const body = await req.json();
  const supabase = await createServiceClient();

  for (const entry of body.entry || []) {
    // Messenger + IG messaging event
    for (const msg of entry.messaging || []) {
      const senderId = msg.sender?.id;
      const pageId = msg.recipient?.id;
      const text = msg.message?.text;
      if (!text || !senderId) continue;

      // localiza agente IA ativo pra essa integracao
      const { data: integ } = await supabase
        .from("integrations")
        .select("tenant_id,cliente_id,access_token")
        .in("provider", ["messenger", "instagram"])
        .limit(1).maybeSingle();

      if (!integ) continue;
      const { data: agent } = await supabase
        .from("ai_agents")
        .select("*").eq("tenant_id", integ.tenant_id).eq("is_active", true).maybeSingle();

      if (!agent) continue;

      // Persiste conversa + mensagem
      const { data: conv } = await supabase.from("conversas").upsert({
        tenant_id: integ.tenant_id,
        cliente_id: integ.cliente_id,
        platform: "messenger",
        external_id: senderId,
        contact_identifier: senderId,
        last_message_at: new Date().toISOString(),
        ai_enabled: true,
      }, { onConflict: "platform,external_id" }).select().single();

      await supabase.from("mensagens").insert({ conversa_id: conv!.id, direction: "in", author: "cliente", content: text });

      // Gera resposta IA
      const { data: lastMsgs } = await supabase
        .from("mensagens").select("direction,content").eq("conversa_id", conv!.id)
        .order("sent_at", { ascending: false }).limit(10);

      const messages = (lastMsgs || []).reverse().map((m) => ({
        role: (m.direction === "in" ? "user" : "assistant") as "user" | "assistant",
        content: m.content || "",
      }));

      const reply = await aiChat({ systemPrompt: agent.system_prompt, messages, model: agent.model });

      await sendMessenger(senderId, reply, integ.access_token!);
      await supabase.from("mensagens").insert({ conversa_id: conv!.id, direction: "out", author: "ia", content: reply });
    }

    // WhatsApp Cloud
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const messages = change.value?.messages || [];
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      for (const m of messages) {
        const from = m.from;
        const text = m.text?.body;
        if (!text || !from) continue;

        const { data: integ } = await supabase
          .from("integrations").select("tenant_id,cliente_id,access_token")
          .eq("provider", "whatsapp_cloud").limit(1).maybeSingle();
        if (!integ) continue;
        const { data: agent } = await supabase.from("ai_agents").select("*").eq("tenant_id", integ.tenant_id).eq("is_active", true).maybeSingle();
        if (!agent) continue;

        const reply = await aiChat({ systemPrompt: agent.system_prompt, messages: [{ role: "user", content: text }], model: agent.model });
        await sendWhatsAppCloud(from, reply, phoneNumberId, integ.access_token!);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// para uso direto pelo frontend se quiser enviar com IG
export const dynamic = "force-dynamic";
void sendInstagramDM; // manter import
