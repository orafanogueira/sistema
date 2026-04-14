import { NextResponse } from "next/server";
import { aiChat, type AIMessage } from "@/lib/integrations/ai";

export async function POST(req: Request) {
  const { messages, systemPrompt, model } = await req.json();
  if (!Array.isArray(messages)) return new NextResponse("messages must be array", { status: 400 });
  try {
    const reply = await aiChat({
      systemPrompt: systemPrompt || "Voce e o assistente interno do Grupo Nogueira. Seja direto, estrategico, sem enrolacao.",
      messages: messages as AIMessage[],
      model,
    });
    return NextResponse.json({ reply });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Erro IA", { status: 500 });
  }
}
