import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runAllDetectors } from "@/lib/alerts/detector";

/**
 * Cron - roda detectores de alertas em todos os tenants.
 * Schedule: a cada hora.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const supabase = await createServiceClient();
  const { data: tenants } = await supabase.from("tenants").select("id");
  let processed = 0;
  for (const t of tenants || []) {
    await runAllDetectors(supabase, t.id);
    processed++;
  }
  return NextResponse.json({ tenants_processados: processed });
}
