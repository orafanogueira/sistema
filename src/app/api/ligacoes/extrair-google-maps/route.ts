import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

interface LeadGoogle {
  nome: string;
  telefone?: string;
  endereco?: string;
  site?: string;
  rating?: number;
  tipo?: string;
  cidade?: string;
}

/**
 * Extrai empresas + telefones do Google Maps via Serper.dev (Places API)
 * Retorna lista pronta pra usar em campanha de ligações IA.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { nicho, cidade, max }: { nicho: string; cidade: string; max?: number } = await req.json();

  if (!nicho || !cidade) {
    return new NextResponse("nicho e cidade são obrigatórios", { status: 400 });
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      leads: [],
      erro: "SERPER_API_KEY não configurada no Vercel",
    });
  }

  const maxResults = Math.min(max || 20, 100);
  const q = `${nicho} em ${cidade}`;
  const leads: LeadGoogle[] = [];
  const seen = new Set<string>();

  try {
    // Serper Places API: retorna Google Maps results
    const r = await fetch("https://google.serper.dev/places", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: maxResults }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ erro: `Serper ${r.status}: ${txt.slice(0, 200)}`, leads: [] });
    }

    const data = await r.json();
    const places = (data.places || []) as Array<Record<string, unknown>>;

    for (const place of places) {
      const nome = String(place.title || "");
      const telefone = String(place.phoneNumber || "");
      if (!nome || seen.has(nome)) continue;
      seen.add(nome);

      leads.push({
        nome,
        telefone: telefone.replace(/\D/g, ""),
        endereco: String(place.address || ""),
        site: String(place.website || ""),
        rating: Number(place.rating) || undefined,
        tipo: String(place.category || place.type || ""),
        cidade,
      });

      if (leads.length >= maxResults) break;
    }

    // se tiver poucos leads, tenta uma 2ª busca via /search (regular)
    if (leads.length < 5) {
      const r2 = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `${nicho} ${cidade} telefone`, gl: "br", hl: "pt-br", num: 20 }),
      });
      if (r2.ok) {
        const data2 = await r2.json();
        const organic = (data2.organic || []) as Array<{ title?: string; snippet?: string; link?: string }>;
        for (const item of organic) {
          // extrai telefone do snippet (regex BR)
          const text = `${item.title || ""} ${item.snippet || ""}`;
          const match = text.match(/(\+?55\s?)?\(?(\d{2})\)?\s?9?\s?\d{4}[-\s]?\d{4}/);
          if (match && item.title && !seen.has(item.title)) {
            seen.add(item.title);
            leads.push({
              nome: item.title,
              telefone: match[0].replace(/\D/g, ""),
              site: item.link,
              cidade,
            });
          }
        }
      }
    }

    return NextResponse.json({
      leads,
      total: leads.length,
      com_telefone: leads.filter((l) => l.telefone).length,
      query: q,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      erro: e instanceof Error ? e.message : "erro",
      leads: [],
    }, { status: 500 });
  }
}
