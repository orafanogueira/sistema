/**
 * Gerador de PDF de relatorio mensal usando pdf-lib (sem dependencia nativa).
 * Converte o HTML do relatorio em PDF renderizando blocos direto no canvas.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Color } from "pdf-lib";

export interface RelatorioPDFInput {
  clienteName: string;
  periodo: string;
  agenciaName?: string;
  data: Record<string, unknown>;
  analise_ia?: string;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
function formatInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
}

export async function gerarPDFRelatorio(input: RelatorioPDFInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 50;

  const bgColor = rgb(0.05, 0.06, 0.1);
  const cyanColor = rgb(0, 0.78, 0.87);
  const textLight = rgb(0.88, 0.92, 0.95);
  const muted = rgb(0.4, 0.45, 0.55);

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  // Background
  page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: bgColor });

  // Header
  page.drawText((input.agenciaName || "Grupo Nogueira").toUpperCase(), {
    x: margin, y, size: 10, font: fontBold, color: cyanColor,
  });
  y -= 20;

  page.drawText(input.clienteName, {
    x: margin, y, size: 24, font: fontBold, color: textLight,
  });
  y -= 30;

  page.drawText(`Relatorio ${input.periodo}`, {
    x: margin, y, size: 12, font, color: muted,
  });
  y -= 40;

  // Linha separadora
  page.drawLine({
    start: { x: margin, y }, end: { x: pageSize[0] - margin, y },
    thickness: 1, color: rgb(0.12, 0.18, 0.24),
  });
  y -= 30;

  // KPIs em cards
  const t = input.data.trafego as { spend: number; clicks: number; leads: number; cpl: number } | undefined;
  const crm = input.data.crm as { total_leads: number; ganhos: number; taxa_conversao: number } | undefined;

  const cards: { label: string; value: string }[] = [];
  if (t) {
    cards.push({ label: "Investido", value: formatBRL(t.spend) });
    cards.push({ label: "Leads", value: formatInt(t.leads) });
    cards.push({ label: "CPL", value: formatBRL(t.cpl) });
    cards.push({ label: "Cliques", value: formatInt(t.clicks) });
  }
  if (crm) {
    cards.push({ label: "Vendas", value: String(crm.ganhos) });
    cards.push({ label: "Conversao", value: `${crm.taxa_conversao.toFixed(1)}%` });
  }

  const cardsPerRow = 3;
  const cardW = (pageSize[0] - margin * 2 - 20) / cardsPerRow;
  const cardH = 60;
  for (let i = 0; i < cards.length; i++) {
    const col = i % cardsPerRow;
    const row = Math.floor(i / cardsPerRow);
    const x = margin + col * (cardW + 10);
    const cardY = y - row * (cardH + 10);

    page.drawRectangle({
      x, y: cardY - cardH, width: cardW, height: cardH,
      color: rgb(0.07, 0.09, 0.15),
      borderColor: rgb(0.12, 0.18, 0.24), borderWidth: 1,
    });
    page.drawText(cards[i].label.toUpperCase(), {
      x: x + 10, y: cardY - 18, size: 8, font, color: muted,
    });
    page.drawText(cards[i].value, {
      x: x + 10, y: cardY - 45, size: 18, font: fontBold, color: textLight,
    });
  }
  const rows = Math.ceil(cards.length / cardsPerRow);
  y -= rows * (cardH + 10) + 30;

  // Analise IA
  if (input.analise_ia) {
    page.drawText("ANALISE", {
      x: margin, y, size: 10, font: fontBold, color: cyanColor,
    });
    y -= 20;

    const texto = input.analise_ia;
    const maxWidth = pageSize[0] - margin * 2;
    const lines = wrapText(texto, font, 11, maxWidth);
    for (const line of lines) {
      if (y < margin + 30) {
        page = doc.addPage(pageSize);
        page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: bgColor });
        y = pageSize[1] - margin;
      }
      page.drawText(line, { x: margin, y, size: 11, font, color: textLight });
      y -= 16;
    }
  }

  // Footer na ultima pagina
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(`Pagina ${i + 1}/${pages.length}  ·  ${input.agenciaName || "Grupo Nogueira"}  ·  gerado em ${new Date().toLocaleDateString("pt-BR")}`, {
      x: margin, y: 20, size: 8, font, color: muted,
    });
  }

  return doc.save();
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const result: string[] = [];
  for (const par of paragraphs) {
    if (!par.trim()) { result.push(""); continue; }
    const words = par.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (cur) result.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) result.push(cur);
  }
  return result;
}
