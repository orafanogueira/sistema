import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

interface GrupoFB {
  titulo: string;
  link: string;
  descricao?: string;
  fonte: string;
  id?: string;
}

/**
 * Busca grupos do Facebook por nicho via Serper.dev (Google Search API).
 * Extrai links facebook.com/groups/XXX de títulos, snippets e URLs.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { nicho, cidade, max }: { nicho: string; cidade?: string; max?: number } = await req.json();
  if (!nicho) return new NextResponse("nicho obrigatório", { status: 400 });

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      grupos: [],
      erro: "Serper.dev não configurado. Adicione SERPER_API_KEY no Vercel.",
    });
  }

  const contextoGeo = cidade ? ` ${cidade}` : "";

  // 3 queries pra maximizar cobertura
  const queries = [
    `site:facebook.com/groups ${nicho}${contextoGeo}`,
    `facebook.com/groups ${nicho}${contextoGeo}`,
    `${nicho}${contextoGeo} grupo facebook`,
  ];

  const maxResults = Math.min(max || 30, 100);
  const seen = new Set<string>();
  const grupos: GrupoFB[] = [];

  for (const q of queries) {
    if (grupos.length >= maxResults) break;

    try {
      const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, num: 30, gl: "br", hl: "pt-br" }),
      });

      if (!r.ok) continue;
      const data = await r.json();
      const organic = (data.organic || []) as Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;

      for (const item of organic) {
        if (grupos.length >= maxResults) break;

        // tenta pegar o ID do grupo na URL (facebook.com/groups/XXXXX ou /groups/nome-do-grupo)
        const texts = [item.link || "", item.title || "", item.snippet || ""];
        for (const text of texts) {
          const matches = text.matchAll(/facebook\.com\/groups\/([A-Za-z0-9._-]{5,100})/gi);
          for (const m of matches) {
            const slug = m[1].replace(/[/?&].*$/, "");
            if (seen.has(slug)) continue;
            seen.add(slug);
            grupos.push({
              titulo: item.title || "Grupo Facebook",
              link: `https://www.facebook.com/groups/${slug}`,
              descricao: item.snippet,
              fonte: item.link || "",
              id: slug,
            });
          }
        }
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({
    grupos: grupos.slice(0, maxResults),
    total: grupos.length,
    queries_executadas: queries,
    credits_usados: queries.length,
  });
}
