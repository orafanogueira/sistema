import { NextResponse } from "next/server";
import { AGENT_CATALOG } from "@/lib/ai-agents/catalog";

export async function GET() {
  return NextResponse.json(AGENT_CATALOG.map((a) => ({
    key: a.key, category: a.category, domain: a.domain,
    name: a.name, description: a.description, icon: a.icon,
    position: a.position, output_format: a.output_format, is_pro: a.is_pro,
    input_schema: a.default_input_schema,
  })));
}
