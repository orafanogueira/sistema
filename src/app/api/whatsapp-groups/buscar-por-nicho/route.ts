import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

interface GrupoEncontrado {
  titulo: string;
  link: string;
  descricao?: string;
  fonte: string;
}

/**
 * Busca grupos públicos de WhatsApp (chat.whatsapp.com/XXXX) por nicho.
 * Usa Serper.dev (Google Search API) — 2500 buscas gratis no trial.
 * Env: SERPER_API_KEY
 *
 * Estratégia:
 * 1. Busca múltiplas queries: "site:chat.whatsapp.com", "nicho + whatsapp grupo", etc
 * 2. Extrai links chat.whatsapp.com/XXX dos títulos, snippets e URLs
 * 3. Dedup por invite code
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
      como_configurar: {
        passo_1: "Acesse serper.dev e faça signup (gratuito)",
        passo_2: "Copie a API key do dashboard",
        passo_3: "Adicione SERPER_API_KEY no Vercel > Environment Variables",
      },
    });
  }

  const contextoGeo = cidade ? ` ${cidade}` : "";

  // 3 queries diferentes pra maximizar cobertura de links
  const queries = [
    `site:chat.whatsapp.com ${nicho}${contextoGeo}`,
    `chat.whatsapp.com ${nicho}${contextoGeo} grupo`,
    `${nicho}${contextoGeo} grupo whatsapp`,
  ];

  const maxResults = Math.min(max || 30, 100);
  const seen = new Set<string>();
  const grupos: GrupoEncontrado[] = [];

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

        const texts = [item.link || "", item.title || "", item.snippet || ""];
        for (const text of texts) {
          // regex: pega chat.whatsapp.com/XXXX (com ou sem protocolo)
          // funciona mesmo com espaço no meio do link (ex: "chat.whatsapp. com/XXXX")
          const matches = text.matchAll(/chat\.whatsapp\.?\s?com\/([A-Za-z0-9_-]{15,30})/gi);
          for (const m of matches) {
            const code = m[1];
            if (seen.has(code)) continue;
            seen.add(code);
            grupos.push({
              titulo: item.title || "Grupo WhatsApp",
              link: `https://chat.whatsapp.com/${code}`,
              descricao: item.snippet,
              fonte: item.link || "",
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
