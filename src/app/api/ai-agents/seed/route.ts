import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AGENT_CATALOG } from "@/lib/ai-agents/catalog";

/**
 * Popula a tabela agent_catalog com os 27 agentes pre-configurados.
 * Roda 1x apos a migration. Idempotente (upsert por key).
 * Usa service_role client puro (sem cookies) pra garantir bypass de RLS.
 */
export async function POST() {
  // 1. valida usuario logado (via client normal com cookies)
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return new NextResponse("unauthorized - faca login primeiro", { status: 401 });

  // 2. cria client service_role PURO (sem cookies do usuario)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({
      error: "env vars ausentes",
      has_url: !!url,
      has_service_key: !!serviceKey,
    }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const errors: { key: string; error: string }[] = [];
  let inserted = 0;

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
      errors.push({ key: a.key, error: error.message });
      continue;
    }
    inserted++;
  }

  return NextResponse.json({
    total: AGENT_CATALOG.length,
    processed: inserted,
    errors: errors.slice(0, 5),
    total_errors: errors.length,
  });
}

export async function GET() {
  return new NextResponse("Use POST pra popular o catalogo", { status: 405 });
}
