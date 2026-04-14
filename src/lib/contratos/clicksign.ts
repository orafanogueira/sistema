/**
 * Cliente da API Clicksign (v2).
 * Docs: https://developers.clicksign.com/
 *
 * Fluxo:
 *  1. POST /api/v1/documents - cria documento (upload base64)
 *  2. POST /api/v1/signers - cria signatarios
 *  3. POST /api/v1/lists - associa signatario ao documento
 *  4. POST /api/v1/notifications - envia pedido de assinatura por email
 *  5. Webhook pra eventos: signed, refused, document_signed, etc
 */

const BASE = process.env.CLICKSIGN_BASE_URL || "https://app.clicksign.com";

function getToken(): string {
  const t = process.env.CLICKSIGN_TOKEN;
  if (!t) throw new Error("CLICKSIGN_TOKEN ausente nas env vars");
  return t;
}

async function csFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${token}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clicksign ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

// Upload de documento PDF em base64
export async function clicksignCriarDocumento(opts: {
  filename: string;
  content_base64: string;        // data:application/pdf;base64,...
  deadline_at?: string;          // ISO
  auto_close?: boolean;          // fecha doc apos todos assinarem
  locale?: "pt-BR" | "en-US";
}) {
  return csFetch<{ document: { key: string; filename: string; status: string; created_at: string } }>(
    "/api/v1/documents",
    {
      method: "POST",
      body: JSON.stringify({
        document: {
          path: `/${opts.filename}`,
          content_base64: opts.content_base64,
          deadline_at: opts.deadline_at,
          auto_close: opts.auto_close ?? true,
          locale: opts.locale || "pt-BR",
        },
      }),
    }
  );
}

export async function clicksignCriarSignatario(opts: {
  email: string;
  name?: string;
  phone_number?: string;         // com DDI, ex: +5511999999999
  documentation?: string;        // CPF
  has_documentation?: boolean;
  auths?: ("email" | "sms" | "whatsapp" | "selfie")[];
}) {
  return csFetch<{ signer: { key: string; email: string; name: string } }>(
    "/api/v1/signers",
    {
      method: "POST",
      body: JSON.stringify({
        signer: {
          email: opts.email,
          name: opts.name,
          phone_number: opts.phone_number,
          documentation: opts.documentation,
          has_documentation: opts.has_documentation ?? !!opts.documentation,
          auths: opts.auths || ["email"],
        },
      }),
    }
  );
}

export async function clicksignAdicionarSignatarioAoDocumento(opts: {
  document_key: string;
  signer_key: string;
  sign_as?: "contractor" | "contractee" | "party" | "witness" | "intervening" | "approver";
  message?: string;
  group?: number;
}) {
  return csFetch<{ list: { key: string; request_signature_key: string } }>(
    "/api/v1/lists",
    {
      method: "POST",
      body: JSON.stringify({
        list: {
          document_key: opts.document_key,
          signer_key: opts.signer_key,
          sign_as: opts.sign_as || "party",
          message: opts.message || "Por favor, assine este contrato.",
          group: opts.group,
        },
      }),
    }
  );
}

export async function clicksignEnviarNotificacao(request_signature_key: string, message?: string) {
  return csFetch("/api/v1/notifications", {
    method: "POST",
    body: JSON.stringify({
      request_signature_key,
      message: message || "Por favor, assine o contrato.",
    }),
  });
}

export async function clicksignBuscarDocumento(document_key: string) {
  return csFetch<{ document: { key: string; status: string; signed_at: string | null; downloads: { original_file_url: string; signed_file_url?: string } } }>(
    `/api/v1/documents/${document_key}`
  );
}

/**
 * Helper all-in-one: cria doc + signatarios + associa + notifica.
 */
export async function clicksignEnvelopar(opts: {
  filename: string;
  pdf_base64: string;
  signatarios: { email: string; name?: string; phone?: string; cpf?: string; role?: "contractor" | "contractee" | "party" | "witness" }[];
  deadline_days?: number;
  auths?: ("email" | "sms" | "whatsapp")[];
}) {
  const deadline = opts.deadline_days
    ? new Date(Date.now() + opts.deadline_days * 86400000).toISOString()
    : undefined;

  const doc = await clicksignCriarDocumento({
    filename: opts.filename,
    content_base64: opts.pdf_base64,
    deadline_at: deadline,
  });

  const signersResult = [];
  for (const s of opts.signatarios) {
    const signer = await clicksignCriarSignatario({
      email: s.email, name: s.name, phone_number: s.phone,
      documentation: s.cpf, auths: opts.auths || ["email"],
    });
    const assoc = await clicksignAdicionarSignatarioAoDocumento({
      document_key: doc.document.key,
      signer_key: signer.signer.key,
      sign_as: s.role || "party",
    });
    await clicksignEnviarNotificacao(assoc.list.request_signature_key);
    signersResult.push({ signer_key: signer.signer.key, request_key: assoc.list.request_signature_key, email: s.email });
  }

  return {
    document_key: doc.document.key,
    signers: signersResult,
  };
}

export interface ClicksignWebhookPayload {
  event: { name: string; data?: Record<string, unknown> };
  document: { key: string; status: string };
  signers?: { key: string; email: string; signed_at: string | null }[];
}
