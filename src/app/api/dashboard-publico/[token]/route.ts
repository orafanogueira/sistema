import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Endpoint publico - cliente acessa via link sem login. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: link } = await supabase.from("dashboard_public_links")
    .select("*,cliente:clientes(id,nome,vertical)")
    .eq("token", token).eq("is_active", true).maybeSingle();

  if (!link) return new NextResponse("link invalido", { status: 404 });

  // check expiracao
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return new NextResponse("link expirado", { status: 410 });
  }

  // incrementa views
  await supabase.from("dashboard_public_links").update({
    views_count: (link.views_count || 0) + 1,
    last_viewed_at: new Date().toISOString(),
  }).eq("id", link.id);

  const cliente_id = link.cliente_id;
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: metrics }, { data: leads }, { data: posts }] = await Promise.all([
    link.show_meta_ads || link.show_google_ads
      ? supabase.from("metrics_daily").select("date,spend,clicks,impressions,leads,conversions,provider")
          .eq("cliente_id", cliente_id).gte("date", since30)
      : Promise.resolve({ data: [] }),
    link.show_leads
      ? supabase.from("leads").select("id,status,origem,created_at")
          .eq("cliente_id", cliente_id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      : Promise.resolve({ data: [] }),
    link.show_social
      ? supabase.from("social_posts").select("id,status,published_at,format")
          .eq("cliente_id", cliente_id).eq("status", "publicado")
          .gte("published_at", new Date(Date.now() - 30 * 86400000).toISOString())
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    cliente: link.cliente,
    config: {
      show_meta_ads: link.show_meta_ads,
      show_google_ads: link.show_google_ads,
      show_leads: link.show_leads,
      show_financeiro: link.show_financeiro,
      show_social: link.show_social,
    },
    periodo: "Ultimos 30 dias",
    metrics: metrics || [],
    leads: leads || [],
    posts: posts || [],
  });
}
