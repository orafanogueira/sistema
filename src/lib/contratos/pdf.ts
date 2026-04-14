/**
 * Gerador de PDF simples a partir de texto.
 * Usa conversao direta em PDF basico (sem dependencias externas) pra
 * enviar ao Clicksign. Clicksign tambem aceita HTML convertido em PDF
 * via servicos como puppeteer, mas pra MVP um PDF simples basta.
 *
 * Alternativa mais robusta: usar @pdfkit ou puppeteer via serverless,
 * que exigem build nativo. Aqui usamos text -> PDF minimo via "jsPDF-like" manual
 * com biblioteca pdf-lib (pure JS) que vem no Node.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function textoParaPDFBase64(titulo: string, texto: string): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4 em pt
  const margin = 50;
  const lineHeight = 14;
  const fontSize = 10;
  const titleSize = 14;

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  // Titulo
  page.drawText(titulo.toUpperCase(), {
    x: margin, y, size: titleSize, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= titleSize * 2;

  // Quebra texto em linhas que cabem
  const maxWidth = pageSize[0] - margin * 2;
  const linhas = quebrarLinhas(texto, font, fontSize, maxWidth);

  for (const linha of linhas) {
    if (y < margin + lineHeight) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
    const isHeader = /^(CLAUSULA|CONTRATO|PARAGRAFO)/i.test(linha.trim());
    page.drawText(linha, {
      x: margin, y, size: fontSize,
      font: isHeader ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  }

  const bytes = await doc.save();
  // Convert to base64 (Node Buffer)
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:application/pdf;base64,${b64}`;
}

function quebrarLinhas(texto: string, font: import("pdf-lib").PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragrafos = texto.split(/\r?\n/);
  const resultado: string[] = [];

  for (const par of paragrafos) {
    if (par.trim() === "") {
      resultado.push("");
      continue;
    }
    const palavras = par.split(" ");
    let linhaAtual = "";
    for (const p of palavras) {
      const test = linhaAtual ? linhaAtual + " " + p : p;
      const w = font.widthOfTextAtSize(test, fontSize);
      if (w > maxWidth) {
        if (linhaAtual) resultado.push(linhaAtual);
        linhaAtual = p;
      } else {
        linhaAtual = test;
      }
    }
    if (linhaAtual) resultado.push(linhaAtual);
  }
  return resultado;
}
