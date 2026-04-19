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
 * Busca grupos públicos de WhatsApp (links chat.whatsapp.com/XXXX) por nicho.
 * Estratégia: usa Google Custom Search API pra buscar indexados públicos.
 * Env: GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { nicho, cidade, max }: { nicho: string; cidade?: string; max?: number } = await req.json();
  if (!nicho) return new NextResponse("nicho obrigatório", { status: 400 });

  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    return NextResponse.json({
      grupos: [],
      erro: "Google Custom Search não configurado. Precisa de GOOGLE_CSE_API_KEY e GOOGLE_CSE_CX no Vercel.",
      como_configurar: {
        passo_1: "Vai em programmablesearchengine.google.com, cria um Custom Search Engine",
        passo_2: "No campo Sites to search deixa vazio OU coloca chat.whatsapp.com",
        passo_3: "Habilita 'Search the entire web'",
        passo_4: "Copia o Search engine ID (CX)",
        passo_5: "Vai em developers.google.com/custom-search/v1/overview e pega uma API key",
        passo_6: "Adiciona GOOGLE_CSE_API_KEY e GOOGLE_CSE_CX no Vercel",
      },
    });
  }

  const q = [
    `"chat.whatsapp.com"`,
    nicho,
    cidade || "",
  ].filter(Boolean).join(" ");

  const maxResults = Math.min(max || 30, 100);
  const grupos: GrupoEncontrado[] = [];
  const seen = new Set<string>();

  // Google CSE retorna 10 por página, paginamos até maxResults
  for (let start = 1; start <= maxResults && grupos.length < maxResults; start += 10) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&start=${start}&num=10`;
      const r = await fetch(url);
      if (!r.ok) break;
      const data = await r.json();
      const items = (data.items || []) as Array<{ title: string; link: string; snippet?: string }>;

      for (const item of items) {
        // extrai o link real do chat.whatsapp.com
        const match = item.link.match(/chat\.whatsapp\.com\/([\w-]+)/);
        if (match) {
          const fullLink = `https://chat.whatsapp.com/${match[1]}`;
          if (!seen.has(fullLink)) {
            seen.add(fullLink);
            grupos.push({
              titulo: item.title,
              link: fullLink,
              descricao: item.snippet,
              fonte: item.link,
            });
          }
          continue;
        }
        // ou pode estar no snippet
        const snippetMatch = item.snippet?.match(/chat\.whatsapp\.com\/([\w-]+)/);
        if (snippetMatch) {
          const fullLink = `https://chat.whatsapp.com/${snippetMatch[1]}`;
          if (!seen.has(fullLink)) {
            seen.add(fullLink);
            grupos.push({
              titulo: item.title,
              link: fullLink,
              descricao: item.snippet,
              fonte: item.link,
            });
          }
        }
      }

      if (items.length < 10) break;
    } catch {
      break;
    }
  }

  return NextResponse.json({
    grupos,
    total: grupos.length,
    query: q,
  });
}
