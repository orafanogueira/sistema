/**
 * Gerador de ebook via IA (multi-step).
 * Passos:
 * 1. Estrutura (titulo, subtitulos, intro, conclusao) - LLM chamada 1
 * 2. Conteudo por capitulo - LLM chamada por capitulo (paralelo)
 * 3. Capa visual SVG
 * 4. Salva em seo_content_items
 */
import { aiChat } from "@/lib/integrations/ai";

export interface EbookInput {
  tema: string;
  publico: string;
  promessa: string;
  num_capitulos?: number;
  tom?: string;
}

export interface EbookOutput {
  titulo: string;
  subtitulo: string;
  capitulos: { titulo: string; conteudo: string }[];
  introducao: string;
  conclusao: string;
  markdown_completo: string;
}

export async function gerarEbook(input: EbookInput): Promise<EbookOutput> {
  const numCaps = input.num_capitulos || 5;

  // Passo 1: Estrutura
  const estrutura = await aiChat({
    systemPrompt: `Voce e autor de ebooks de info-produto.
Crie a estrutura de um ebook de ~${numCaps * 1500} palavras com ${numCaps} capitulos.
Tom: ${input.tom || "direto, brasileiro natural, didatico"}.
Devolva JSON valido no formato:
{
  "titulo": "titulo curto chamativo",
  "subtitulo": "subtitulo que detalha",
  "introducao_resumo": "2-3 frases do que vai falar",
  "capitulos": [{"titulo": "...", "resumo": "o que o cap vai cobrir"}],
  "conclusao_resumo": "como fechar"
}
Sem texto fora do JSON.`,
    messages: [{
      role: "user",
      content: `Tema: ${input.tema}\nPublico: ${input.publico}\nPromessa: ${input.promessa}\n\nCrie estrutura.`,
    }],
    temperature: 0.6, maxTokens: 1500,
  });

  let struct: { titulo: string; subtitulo: string; introducao_resumo: string; capitulos: { titulo: string; resumo: string }[]; conclusao_resumo: string };
  try {
    const cleaned = estrutura.replace(/```json\s*|\s*```/g, "").trim();
    struct = JSON.parse(cleaned);
  } catch {
    throw new Error("IA nao retornou JSON valido pra estrutura");
  }

  // Passo 2: Introducao
  const introducao = await aiChat({
    systemPrompt: "Voce escreve intro de ebook que prende a atencao nas primeiras 3 frases. Estilo direto, brasileiro, ~300 palavras.",
    messages: [{ role: "user", content: `Tema: ${input.tema}\nPromessa: ${input.promessa}\nResumo: ${struct.introducao_resumo}\n\nEscreva a introducao completa.` }],
    temperature: 0.7, maxTokens: 700,
  });

  // Passo 3: Capitulos (sequencial pra nao estourar rate limit)
  const capitulos: { titulo: string; conteudo: string }[] = [];
  for (const cap of struct.capitulos) {
    const conteudo = await aiChat({
      systemPrompt: `Voce escreve capitulos de ebook com 1000-1500 palavras. Use H2 e H3, exemplos praticos, listas. Tom: ${input.tom || "didatico direto"}.`,
      messages: [{ role: "user", content: `Tema geral: ${input.tema}\nPublico: ${input.publico}\n\nCapitulo: ${cap.titulo}\nDeve cobrir: ${cap.resumo}\n\nEscreva o capitulo completo em markdown.` }],
      temperature: 0.6, maxTokens: 2500,
    });
    capitulos.push({ titulo: cap.titulo, conteudo });
  }

  // Passo 4: Conclusao
  const conclusao = await aiChat({
    systemPrompt: "Voce escreve conclusao de ebook com CTA claro pro leitor aplicar. ~400 palavras.",
    messages: [{ role: "user", content: `Tema: ${input.tema}\nResumo: ${struct.conclusao_resumo}\n\nEscreva conclusao completa.` }],
    temperature: 0.7, maxTokens: 800,
  });

  // Markdown completo
  const md = `# ${struct.titulo}\n\n*${struct.subtitulo}*\n\n---\n\n## Introducao\n\n${introducao}\n\n---\n\n${capitulos.map((c, i) => `## Capitulo ${i + 1}: ${c.titulo}\n\n${c.conteudo}\n`).join("\n---\n\n")}\n\n---\n\n## Conclusao\n\n${conclusao}\n`;

  return {
    titulo: struct.titulo,
    subtitulo: struct.subtitulo,
    capitulos,
    introducao,
    conclusao,
    markdown_completo: md,
  };
}
