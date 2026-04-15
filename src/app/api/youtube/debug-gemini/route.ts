import { NextResponse } from "next/server";

/** GET: lista modelos Gemini disponiveis na sua API key (debug) */
export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY ausente" }, { status: 500 });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  if (!r.ok) return NextResponse.json({ error: `${r.status}: ${(await r.text()).slice(0, 500)}` }, { status: 500 });
  const data = await r.json();
  type Model = { name: string; supportedGenerationMethods?: string[]; description?: string };
  const allModels = (data.models || []) as Model[];
  const imageModels = allModels.filter((m) =>
    m.name.toLowerCase().includes("image") ||
    m.name.toLowerCase().includes("imagen") ||
    (m.supportedGenerationMethods || []).some((s) => s.toLowerCase().includes("predict"))
  );
  return NextResponse.json({
    total: allModels.length,
    image_models: imageModels.map((m) => ({ name: m.name, methods: m.supportedGenerationMethods })),
    all_model_names: allModels.map((m) => m.name).slice(0, 30),
  });
}
