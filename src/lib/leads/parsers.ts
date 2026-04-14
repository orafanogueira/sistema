/**
 * Parsers de leads vindos de diferentes plataformas/portais.
 * Cada parser recebe payload bruto e devolve um lead normalizado.
 */

export type LeadOrigem =
  | "meta_ads_facebook" | "meta_ads_instagram" | "meta_ads_messenger" | "meta_ads_whatsapp"
  | "google_ads_search" | "google_ads_youtube" | "google_ads_display" | "google_ads_shopping"
  | "webmotors" | "olx" | "mercadolivre" | "revenda_mais" | "mobiauto" | "icarros"
  | "autoadm" | "nuvem_auto" | "loja_conectada" | "estoque_integrado" | "integracarros"
  | "motorleads" | "autocerto" | "autoconf" | "organico" | "direto" | "indicacao" | "outro";

export interface NormalizedLead {
  nome?: string; email?: string; telefone?: string; whatsapp?: string;
  cidade?: string; estado?: string;
  origem: LeadOrigem; origem_detalhe?: string;
  modelo_interesse?: string; marca_interesse?: string; ano_interesse?: number;
  preco_max?: number;
  veiculo_external_id?: string;
  source_url?: string;
  utm?: Record<string, string>;
  fbclid?: string; gclid?: string;
  observacoes?: string;
  raw: unknown;
}

// ============================================================
// Detector por origem - identifica plataforma a partir do payload
// ============================================================
export function detectOrigem(payload: Record<string, unknown>, headers?: Record<string, string>): LeadOrigem {
  const ua = (headers?.["user-agent"] || "").toLowerCase();
  const refer = (headers?.referer || "").toLowerCase();

  if (payload.fbclid || payload.fb_lead_id || (payload.platform === "facebook")) return "meta_ads_facebook";
  if (payload.gclid) {
    const network = String(payload.network || payload.gad_network || "").toLowerCase();
    if (network.includes("youtube")) return "google_ads_youtube";
    if (network.includes("display")) return "google_ads_display";
    if (network.includes("shopping")) return "google_ads_shopping";
    return "google_ads_search";
  }
  if (refer.includes("webmotors") || ua.includes("webmotors")) return "webmotors";
  if (refer.includes("icarros")) return "icarros";
  if (refer.includes("mobiauto")) return "mobiauto";
  if (refer.includes("olx")) return "olx";
  if (refer.includes("mercadolivre")) return "mercadolivre";

  // payload tem campo "origem" ou "source"
  const src = String(payload.source || payload.origem || payload.platform || "").toLowerCase();
  if (src) {
    if (src.includes("webmotors")) return "webmotors";
    if (src.includes("icarros")) return "icarros";
    if (src.includes("mobiauto")) return "mobiauto";
    if (src.includes("olx")) return "olx";
    if (src.includes("mercado")) return "mercadolivre";
    if (src.includes("autoadm")) return "autoadm";
    if (src.includes("revenda")) return "revenda_mais";
    if (src.includes("autoconf")) return "autoconf";
    if (src.includes("autocerto")) return "autocerto";
    if (src.includes("loja_conectada") || src.includes("loja-conectada")) return "loja_conectada";
    if (src.includes("nuvem")) return "nuvem_auto";
    if (src.includes("integracarros")) return "integracarros";
    if (src.includes("motorleads")) return "motorleads";
    if (src.includes("estoque")) return "estoque_integrado";
  }
  return "outro";
}

// ============================================================
// Parser generico - tenta extrair de qualquer payload JSON
// ============================================================
export function parseGenerico(payload: Record<string, unknown>): NormalizedLead {
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = payload[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };

  const fone = get("phone", "telefone", "celular", "whatsapp", "mobile", "tel");
  return {
    nome: get("name", "nome", "fullname", "full_name", "nome_completo", "lead_name"),
    email: get("email", "e_mail", "lead_email"),
    telefone: fone,
    whatsapp: fone, // mesmo numero, normalizamos depois
    cidade: get("cidade", "city", "municipio"),
    estado: get("estado", "uf", "state", "region"),
    origem: detectOrigem(payload),
    origem_detalhe: get("source", "origem_detalhe", "campaign", "ad_id"),
    modelo_interesse: get("modelo", "model", "vehicle_model", "veiculo_modelo", "interest"),
    marca_interesse: get("marca", "brand", "vehicle_make"),
    ano_interesse: payload.ano ? Number(payload.ano) : payload.year ? Number(payload.year) : undefined,
    preco_max: payload.preco_max ? Number(payload.preco_max) : payload.budget ? Number(payload.budget) : undefined,
    veiculo_external_id: get("vehicle_id", "veiculo_id", "ad_id", "external_id"),
    source_url: get("url", "source_url", "page_url", "landing_page"),
    utm: payload.utm as Record<string, string> | undefined,
    fbclid: payload.fbclid as string | undefined,
    gclid: payload.gclid as string | undefined,
    observacoes: get("message", "mensagem", "observacao", "notes", "comment"),
    raw: payload,
  };
}

// ============================================================
// Parsers especificos (formato proprio de cada portal)
// ============================================================
export function parseWebmotors(payload: Record<string, unknown>): NormalizedLead {
  // Webmotors envia algo como: {Nome, Email, Telefone, VeiculoID, Modelo, Anuncio}
  return {
    nome: payload.Nome as string,
    email: payload.Email as string,
    telefone: (payload.Telefone || payload.Celular) as string,
    whatsapp: (payload.Celular || payload.Telefone) as string,
    modelo_interesse: payload.Modelo as string,
    marca_interesse: payload.Marca as string,
    ano_interesse: payload.Ano ? Number(payload.Ano) : undefined,
    veiculo_external_id: (payload.VeiculoID || payload.AnuncioID) as string,
    origem: "webmotors",
    origem_detalhe: payload.Anuncio as string,
    observacoes: payload.Mensagem as string,
    raw: payload,
  };
}

export function parseMobiauto(payload: Record<string, unknown>): NormalizedLead {
  return {
    nome: (payload.contact_name || payload.name) as string,
    email: payload.contact_email as string,
    telefone: (payload.contact_phone || payload.phone) as string,
    whatsapp: payload.contact_phone as string,
    modelo_interesse: (payload.vehicle_model || payload.model) as string,
    marca_interesse: payload.vehicle_make as string,
    ano_interesse: payload.vehicle_year ? Number(payload.vehicle_year) : undefined,
    veiculo_external_id: payload.vehicle_id as string,
    origem: "mobiauto",
    observacoes: payload.message as string,
    raw: payload,
  };
}

export function parseIcarros(payload: Record<string, unknown>): NormalizedLead {
  return {
    nome: (payload.nomeContato || payload.nome) as string,
    email: payload.emailContato as string,
    telefone: (payload.telefoneContato || payload.celularContato) as string,
    whatsapp: payload.celularContato as string,
    modelo_interesse: payload.modelo as string,
    marca_interesse: payload.marca as string,
    ano_interesse: payload.ano ? Number(payload.ano) : undefined,
    veiculo_external_id: payload.idAnuncio as string,
    origem: "icarros",
    observacoes: payload.mensagem as string,
    raw: payload,
  };
}

export const PORTAL_PARSERS: Record<string, (payload: Record<string, unknown>) => NormalizedLead> = {
  webmotors: parseWebmotors,
  mobiauto: parseMobiauto,
  icarros: parseIcarros,
};

// ============================================================
// Parser de email (texto puro / html simples)
// ============================================================
export function parseEmailLead(emailText: string): NormalizedLead {
  const ext = (regex: RegExp): string | undefined => {
    const m = emailText.match(regex);
    return m?.[1]?.trim();
  };

  const nome = ext(/(?:nome|name)[:\s]+([^\n\r]+)/i);
  const email = ext(/(?:email|e-?mail)[:\s]+([\w.+-]+@[\w-]+\.[\w.-]+)/i);
  const telefone = ext(/(?:telefone|celular|phone|whatsapp|tel)[:\s]+([\d\s\-\(\)\+]+)/i);
  const modelo = ext(/(?:modelo|model|veiculo|interesse)[:\s]+([^\n\r]+)/i);
  const marca = ext(/marca[:\s]+([^\n\r]+)/i);

  // detecta origem por palavras-chave no email
  let origem: LeadOrigem = "outro";
  const lower = emailText.toLowerCase();
  if (lower.includes("webmotors")) origem = "webmotors";
  else if (lower.includes("mobiauto")) origem = "mobiauto";
  else if (lower.includes("icarros")) origem = "icarros";
  else if (lower.includes("olx")) origem = "olx";
  else if (lower.includes("mercadolivre") || lower.includes("mercado livre")) origem = "mercadolivre";
  else if (lower.includes("revenda")) origem = "revenda_mais";
  else if (lower.includes("autoadm")) origem = "autoadm";
  else if (lower.includes("loja conectada")) origem = "loja_conectada";
  else if (lower.includes("nuvem auto")) origem = "nuvem_auto";
  else if (lower.includes("autocerto")) origem = "autocerto";
  else if (lower.includes("autoconf")) origem = "autoconf";
  else if (lower.includes("motorleads")) origem = "motorleads";
  else if (lower.includes("estoque integrado")) origem = "estoque_integrado";
  else if (lower.includes("integracarros")) origem = "integracarros";

  return {
    nome, email, telefone, whatsapp: telefone,
    modelo_interesse: modelo, marca_interesse: marca,
    origem,
    observacoes: emailText.slice(0, 800),
    raw: { source: "email_parser", text: emailText },
  };
}

// ============================================================
// Normalizador de telefone (BR)
// ============================================================
export function normalizePhone(input?: string): string | undefined {
  if (!input) return undefined;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] !== "5") digits = "55" + digits;
  if (digits.length === 10) digits = "55" + digits;
  return digits || undefined;
}
