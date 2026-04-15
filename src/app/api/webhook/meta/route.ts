import { NextResponse } from "next/server";
import { verifyMetaWebhook, sendMessenger, sendInstagramDM, sendWhatsAppCloud } from "@/lib/integrations/meta-messaging";
import { createServiceClient } from "@/lib/supabase/server";
import { aiChat } from "@/lib/integrations/ai";
import { processIgComment } from "@/lib/instagram/comment-processor";

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

/** POST - handle eventos Meta (mensagens + comentarios IG) */
export async function POST(req: Request) {
  const body = await req.json();
  const supabase = createServiceClient();

  console.log("[META WEBHOOK] hit. entries:", body.entry?.length || 0);

  for (const entry of body.entry || []) {
    // ============================================================
    // Messenger + IG messaging
    // ============================================================
    for (const msg of entry.messaging || []) {
      const senderId = msg.sender?.id;
      const text = msg.message?.text;
      if (!text || !senderId) continue;

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

      const { data: lastMsgs } = await supabase
        .from("mensagens").select("direction,content").eq("conversa_id", conv!.id)
        .order("sent_at", { ascending: false }).limit(10);

      const messages = (lastMsgs || []).reverse().map((m) => ({
        role: (m.direction === "in" ? "user" : "assistant") as "user" | "assistant",
        content: m.content || "",
      }));

      try {
        const reply = await aiChat({ systemPrompt: agent.system_prompt, messages, model: agent.model });
        await sendMessenger(senderId, reply, integ.access_token!);
        await supabase.from("mensagens").insert({ conversa_id: conv!.id, direction: "out", author: "ia", content: reply });
      } catch (e: unknown) {
        console.log("[META WEBHOOK] erro IA:", e instanceof Error ? e.message : "?");
      }
    }

    // ============================================================
    // Changes (WhatsApp Cloud + Instagram comments + page events)
    // ============================================================
    for (const change of entry.changes || []) {
      // --- WhatsApp Cloud
      if (change.field === "messages") {
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
          const { data: agent } = await supabase.from("ai_agents").select("*")
            .eq("tenant_id", integ.tenant_id).eq("is_active", true).maybeSingle();
          if (!agent) continue;

          const reply = await aiChat({ systemPrompt: agent.system_prompt, messages: [{ role: "user", content: text }], model: agent.model });
          await sendWhatsAppCloud(from, reply, phoneNumberId, integ.access_token!);
        }
      }

      // --- Instagram Comments (ManyChat-like feature)
      if (change.field === "comments") {
        const v = change.value;
        const comment_id = v?.id;
        const post_id = v?.media?.id;
        const author_igsid = v?.from?.id;
        const author_username = v?.from?.username;
        const comment_text = v?.text;
        const ig_account_external_id = entry.id; // IG Business Account ID

        if (!comment_id || !author_igsid || !comment_text) continue;

        // ignora comentarios da propria loja
        if (author_igsid === ig_account_external_id) continue;

        // acha conta IG conectada
        const { data: igAcc } = await supabase.from("instagram_accounts")
          .select("id,tenant_id,cliente_id,page_access_token")
          .eq("ig_user_id", ig_account_external_id).maybeSingle();
        if (!igAcc) {
          console.log("[META WEBHOOK] IG account nao conectada:", ig_account_external_id);
          continue;
        }

        try {
          const result = await processIgComment({
            supabase,
            cliente_id: igAcc.cliente_id!,
            ig_account_id: igAcc.id,
            page_access_token: igAcc.page_access_token!,
            ig_user_business_id: ig_account_external_id,
            comment_id, post_id, author_igsid, author_username,
            comment_text,
          });
          console.log("[META WEBHOOK] comment processed:", JSON.stringify(result));
        } catch (e: unknown) {
          console.log("[META WEBHOOK] comment error:", e instanceof Error ? e.message : "?");
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// manter import pra nao quebrar build se for usado em outro lugar
void sendInstagramDM;
export const dynamic = "force-dynamic";
