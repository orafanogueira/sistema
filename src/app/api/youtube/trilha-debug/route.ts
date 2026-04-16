import { NextResponse } from "next/server";

/** GET /api/youtube/trilha-debug — testa exatamente o payload do docs */
export async function GET() {
  const key = process.env.SUNOAPI_KEY || process.env.SUNO_API_KEY;
  if (!key) return NextResponse.json({ error: "key ausente" });

  // Payload EXATO do exemplo da doc aimusicapi.ai
  const docsExample = {
    custom_mode: false,
    mv: "sonic-v4-5",
    title: "Summer Vibes",
    tags: "pop, summer",
    gpt_description_prompt: "An upbeat summer song about beach parties and good times",
  };

  const r = await fetch("https://api.aimusicapi.ai/api/v1/sonic/create", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(docsExample),
  });

  const body = await r.text();
  return NextResponse.json({
    endpoint: "https://api.aimusicapi.ai/api/v1/sonic/create",
    payload_enviado: docsExample,
    status: r.status,
    body: body.slice(0, 800),
    key_preview: `${key.slice(0, 6)}...${key.slice(-4)}`,
  });
}
