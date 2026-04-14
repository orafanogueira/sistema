import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { AGENT_CATALOG } from "@/lib/ai-agents/catalog";

/**
 * Popula a tabela agent_catalog com os 27 agentes pre-configurados.
 * Roda 1x apos a migration. Idempotente (upsert por key).
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    // permite tambem owner do tenant chamar via UI
    const supabase = await createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = await createServiceClient();

  let inserted = 0, updated = 0;
  for (const a of AGENT_CATALOG) {
    const { error } = await supabase.from("agent_catalog").upsert({
      key: a.key,
      category: a.category,
      domain: a.domain,
      name: a.name,
      description: a.description,
      default_system_prompt: a.default_system_prompt,
      default_input_schema: a.default_input_schema,
      output_format: a.output_format,
      recommended_temperature: a.recommended_temperature,
      icon: a.icon,
      position: a.position,
      is_pro: a.is_pro,
    }, { onConflict: "key" });
    if (error) {
      console.error(`Erro ao seed ${a.key}:`, error.message);
      continue;
    }
    inserted++;
  }

  return NextResponse.json({ total: AGENT_CATALOG.length, processed: inserted });
}

export async function GET() {
  return new NextResponse("Use POST pra popular o catalogo", { status: 405 });
}
