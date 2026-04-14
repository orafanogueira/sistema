import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOfflineCSV, formatConversionTimeBR } from "@/lib/rastreamento/google-offline";

/**
 * Exporta CSV pronto pra upload no Google Ads > Tools > Conversions > Upload.
 * Filtra pixel_events do provider google_offline em um cliente.
 *
 * GET /api/google-offline/export?cliente_id=XXX
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  const since = url.searchParams.get("since"); // ISO date opcional

  if (!cliente_id) return new NextResponse("cliente_id obrigatorio", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  let q = supabase.from("pixel_events")
    .select("*,lead:leads(gclid)")
    .eq("cliente_id", cliente_id)
    .eq("provider", "google_offline")
    .order("created_at", { ascending: true });

  if (since) q = q.gte("created_at", since);

  const { data: events } = await q;
  if (!events?.length) {
    return new NextResponse("nenhum evento pra exportar", { status: 404 });
  }

  const rows = events
    .map((ev) => {
      const lead = ev.lead as { gclid?: string } | null;
      const gclid = lead?.gclid || (ev.payload as Record<string, unknown>)?.gclid as string;
      if (!gclid) return null;
      return {
        google_click_id: gclid,
        conversion_name: ev.event_name,
        conversion_time: formatConversionTimeBR(new Date(ev.created_at)),
        conversion_value: ev.value ? Number(ev.value) : undefined,
        conversion_currency: ev.currency || "BRL",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (!rows.length) return new NextResponse("nenhum evento com gclid valido", { status: 404 });

  const csv = generateOfflineCSV(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="google-offline-conversions-${Date.now()}.csv"`,
    },
  });
}
