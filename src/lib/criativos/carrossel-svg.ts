/**
 * Gerador de carrossel em SVG (slides 1080x1080).
 * Pega o output do agente social_carrossel (JSON com slides) e renderiza
 * cada slide como SVG que pode ser baixado ou convertido pra PNG.
 */

export interface SlideData {
  ordem: number;
  tipo?: string;
  titulo: string;
  texto?: string;
  elemento_visual?: string;
}

export interface CarrosselInput {
  titulo_capa?: string;
  subtitulo_capa?: string;
  slides: SlideData[];
  cor_primaria?: string;
  cor_secundaria?: string;
  marca_nome?: string;
}

export function renderCarrosselSVG(input: CarrosselInput): string[] {
  const corPri = input.cor_primaria || "#0055cc";
  const corSec = input.cor_secundaria || "#00c8e0";
  const marca = input.marca_nome || "";
  return input.slides.map((s) => renderSlide(s, { corPri, corSec, marca, total: input.slides.length }));
}

function renderSlide(s: SlideData, opts: { corPri: string; corSec: string; marca: string; total: number }): string {
  const { corPri, corSec, marca, total } = opts;
  const W = 1080, H = 1080;

  // escape XML
  const esc = (t: string) => t.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] as string));

  const titulo = esc(s.titulo);
  const texto = s.texto ? esc(s.texto) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${corPri}"/>
      <stop offset="100%" stop-color="${corSec}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="40" y="40" width="1000" height="1000" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2" rx="20"/>

  <text x="80" y="110" font-family="Inter, Arial, sans-serif" font-size="24" fill="rgba(255,255,255,.7)" font-weight="600">
    ${s.ordem} / ${total}  ${s.tipo ? "· " + esc(s.tipo.toUpperCase()) : ""}
  </text>

  ${renderWrappedText(titulo, 80, 260, 920, 60, "800", "#ffffff")}

  ${texto ? renderWrappedText(texto, 80, 520, 920, 32, "400", "rgba(255,255,255,.9)") : ""}

  ${marca ? `<text x="80" y="1000" font-family="Inter, Arial, sans-serif" font-size="22" fill="rgba(255,255,255,.7)" font-weight="700">${esc(marca)}</text>` : ""}

  <text x="${W - 80}" y="1000" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="22" fill="rgba(255,255,255,.7)">
    Arrasta →
  </text>
</svg>`;
}

// simples wrap de texto em SVG
function renderWrappedText(text: string, x: number, y: number, maxWidth: number, fontSize: number, weight: string, color: string): string {
  const approxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.55));
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > approxCharsPerLine && cur) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);

  const lineHeight = fontSize * 1.2;
  return lines.map((l, i) =>
    `<text x="${x}" y="${y + i * lineHeight}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${l}</text>`
  ).join("\n");
}
