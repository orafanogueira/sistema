import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCopilot } from "@/lib/copilot/runner";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { conversation_id, message } = body;

  let convId = conversation_id;
  if (!convId) {
    const { data: conv } = await supabase.from("copilot_conversations").insert({
      tenant_id: m.tenant_id, user_id: user.id, title: message.slice(0, 60),
    }).select().single();
    convId = conv?.id;
  }

  await supabase.from("copilot_messages").insert({
    conversation_id: convId, role: "user", content: message,
  });

  const { data: history } = await supabase.from("copilot_messages")
    .select("role,content").eq("conversation_id", convId).order("created_at").limit(20);

  const msgs = (history || []).filter((h) => h.role === "user" || h.role === "assistant")
    .map((h) => ({ role: h.role as "user" | "assistant", content: h.content || "" }));

  try {
    const result = await runCopilot({
      messages: msgs,
      context: { supabase, tenant_id: m.tenant_id, user_id: user.id },
    });

    await supabase.from("copilot_messages").insert({
      conversation_id: convId, role: "assistant", content: result.reply,
      tool_calls: result.tool_calls,
    });

    await supabase.from("copilot_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);

    return NextResponse.json({ conversation_id: convId, reply: result.reply, tool_calls: result.tool_calls });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const conv_id = url.searchParams.get("conversation_id");
  if (conv_id) {
    const { data } = await supabase.from("copilot_messages")
      .select("*").eq("conversation_id", conv_id).order("created_at");
    return NextResponse.json(data || []);
  }
  const { data } = await supabase.from("copilot_conversations")
    .select("id,title,last_message_at").order("last_message_at", { ascending: false }).limit(20);
  return NextResponse.json(data || []);
}
