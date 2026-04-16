import { NextResponse } from "next/server";

/** GET /api/youtube/trilha-debug — testa auth da AIMusicAPI */
export async function GET() {
  const key = process.env.SUNOAPI_KEY || process.env.SUNO_API_KEY;
  if (!key) return NextResponse.json({ error: "key ausente" });

  // testa /get-credits (endpoint mais simples que existe)
  const r = await fetch("https://api.aimusicapi.ai/api/v1/get-credits", {
    headers: { "Authorization": `Bearer ${key}` },
  });

  const status = r.status;
  const body = await r.text();
  return NextResponse.json({
    endpoint: "https://api.aimusicapi.ai/api/v1/get-credits",
    status,
    body: body.slice(0, 500),
    key_preview: `${key.slice(0, 6)}...${key.slice(-4)}`,
  });
}
