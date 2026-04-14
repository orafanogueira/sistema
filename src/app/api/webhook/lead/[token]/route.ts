import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestLead } from "@/lib/leads/ingest";
import { parseGenerico, PORTAL_PARSERS } from "@/lib/leads/parsers";

/**
 * Webhook universal de leads.
 * URL: POST /api/webhook/lead/[token]
 * - token = cliente.webhook_token (cada cliente tem o seu)
 * - aceita query ?portal=webmotors|mobiauto|icarros pra usar parser especifico
 * - sem portal: tenta parsear como JSON generico
 *
 * Configurar em cada portal: cole essa URL no campo "Webhook" do painel deles.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServiceClient();
  const url = new URL(req.url);
  const portal = url.searchParams.get("portal") || "";

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id,tenant_id,nome,vertical")
    .eq("webhook_token", token).maybeSingle();
  if (!cliente) return new NextResponse("token invalido", { status: 404 });

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); }
  catch {
    const text = await req.text();
    payload = { raw: text };
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  const parser = portal && PORTAL_PARSERS[portal] ? PORTAL_PARSERS[portal] : parseGenerico;
  const normalized = parser(payload);
  if (portal && !normalized.origem_detalhe) normalized.origem_detalhe = portal;

  try {
    const lead = await ingestLead({ supabase, tenant_id: cliente.tenant_id, cliente_id: cliente.id, lead: normalized });
    return NextResponse.json({ ok: true, lead_id: lead.id, origem: lead.origem });
  } catch (e: unknown) {
    return new NextResponse(`falha ingest: ${e instanceof Error ? e.message : "erro"}`, { status: 500 });
  }
}

export async function GET() {
  return new NextResponse("envia POST com payload do lead", { status: 405 });
}
