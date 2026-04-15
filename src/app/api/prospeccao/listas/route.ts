import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPlaces, phoneToWhatsApp } from "@/lib/prospeccao/google-places";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("prospeccao_listas")
    .select("*,leads_count:prospeccao_leads(count)")
    .order("created_at", { ascending: false });
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const { name, segmento, cidade, estado, qtd_alvo } = await req.json();
  if (!segmento || !cidade) return new NextResponse("segmento e cidade obrigatorios", { status: 400 });

  // 1. cria lista
  const { data: lista, error } = await supabase.from("prospeccao_listas").insert({
    tenant_id: m.tenant_id,
    name: name || `${segmento} - ${cidade}`,
    segmento, cidade, estado: estado || null,
    qtd_alvo: Math.min(Number(qtd_alvo) || 20, 50),
    created_by: user.id,
  }).select().single();
  if (error) return new NextResponse(error.message, { status: 400 });

  // 2. busca Google Places
  const query = `${segmento} em ${cidade}${estado ? ", " + estado : ""}`;
  let places;
  try {
    places = await searchPlaces(query, lista.qtd_alvo);
  } catch (e: unknown) {
    await supabase.from("prospeccao_listas").update({ status: "pausada" }).eq("id", lista.id);
    return new NextResponse(`Erro Google Places: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 });
  }

  if (places.length === 0) {
    return NextResponse.json({ lista, inserted: 0, message: "Nenhum resultado encontrado pra essa busca" });
  }

  // 3. insere leads (upsert por place_id pra nao duplicar)
  const leads = places.map((p, i) => {
    const whats = phoneToWhatsApp(p.telefone);
    return {
      tenant_id: m.tenant_id,
      lista_id: lista.id,
      nome: p.nome,
      endereco: p.endereco,
      cidade,
      estado: estado || null,
      telefone: p.telefone || null,
      whatsapp: whats,
      website: p.website || null,
      segmento,
      categoria: p.categoria,
      rating: p.rating,
      reviews_count: p.reviews_count,
      google_place_id: p.place_id,
      google_maps_url: p.google_maps_url,
      latitude: p.latitude,
      longitude: p.longitude,
      status: "novo",
      position: i,
    };
  });

  const { data: inserted, error: insErr } = await supabase.from("prospeccao_leads")
    .upsert(leads, { onConflict: "google_place_id", ignoreDuplicates: true })
    .select();

  if (insErr) {
    return new NextResponse(`Erro ao salvar leads: ${insErr.message}`, { status: 400 });
  }

  return NextResponse.json({ lista, inserted: inserted?.length || 0, total_found: places.length });
}
