/**
 * Instagram Graph API wrapper (via Meta Graph API).
 * Docs: https://developers.facebook.com/docs/instagram-platform
 *
 * Operacoes:
 * - Enviar DM (Private Reply) pra quem comentou
 * - Responder comentario publicamente
 * - Listar posts/media
 * - Verificar se e seguidor
 */

const BASE = "https://graph.facebook.com";
const VERSION = process.env.META_API_VERSION || "v20.0";

function buildUrl(path: string, token: string, params?: Record<string, string>) {
  const u = new URL(`${BASE}/${VERSION}/${path}`);
  u.searchParams.set("access_token", token);
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function fetchIG<T>(path: string, token: string, init?: RequestInit, params?: Record<string, string>): Promise<T> {
  const res = await fetch(buildUrl(path, token, params), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`IG Graph ${res.status}: ${body.slice(0, 400)}`);
  return JSON.parse(body);
}

// ============================================================
// DM PRIVADA (Private Reply a um comentario)
// ============================================================
/**
 * Responde privadamente a um comentario especifico.
 * Funciona ate 7 dias apos o comentario.
 * Essa e a forma MAIS COMUM de acionar "comente pra receber".
 */
export async function igPrivateReplyToComment(opts: {
  ig_user_id: string;       // IG Business Account ID
  comment_id: string;
  message: string;
  page_access_token: string;
}) {
  return fetchIG<{ recipient_id: string; message_id: string }>(
    `${opts.ig_user_id}/messages`,
    opts.page_access_token,
    {
      method: "POST",
      body: JSON.stringify({
        recipient: { comment_id: opts.comment_id },
        message: { text: opts.message },
      }),
    }
  );
}

// ============================================================
// DM direta (apos user iniciar conversa)
// ============================================================
export async function igSendDM(opts: {
  ig_user_id: string;       // IG Business ID
  recipient_igsid: string;  // IGSID do destinatario
  message: string;
  page_access_token: string;
}) {
  return fetchIG(
    `${opts.ig_user_id}/messages`,
    opts.page_access_token,
    {
      method: "POST",
      body: JSON.stringify({
        recipient: { id: opts.recipient_igsid },
        message: { text: opts.message },
        messaging_type: "RESPONSE",
      }),
    }
  );
}

// ============================================================
// Reply publico a um comentario
// ============================================================
export async function igReplyToCommentPublic(opts: {
  comment_id: string;
  message: string;
  page_access_token: string;
}) {
  return fetchIG<{ id: string }>(
    `${opts.comment_id}/replies`,
    opts.page_access_token,
    { method: "POST", body: JSON.stringify({ message: opts.message }) }
  );
}

// ============================================================
// Listar media (posts)
// ============================================================
export interface IGMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

export async function igListMedia(opts: {
  ig_user_id: string;
  page_access_token: string;
  limit?: number;
}): Promise<IGMedia[]> {
  const res = await fetchIG<{ data: IGMedia[] }>(
    `${opts.ig_user_id}/media`,
    opts.page_access_token,
    undefined,
    {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
      limit: String(opts.limit || 25),
    }
  );
  return res.data;
}

// ============================================================
// Get user info (pra pegar username do autor do comentario)
// ============================================================
export async function igGetUserInfo(igsid: string, page_access_token: string) {
  return fetchIG<{ id: string; username?: string; name?: string }>(
    igsid,
    page_access_token,
    undefined,
    { fields: "id,username,name" }
  );
}

// ============================================================
// Verificar se e seguidor (opcional)
// ============================================================
/**
 * Nota: API "follow_count" mostra quantos seguidores o user tem,
 * mas pra verificar se um user especifico segue outro, e limitado.
 * Solucao pratica: tentar enviar DM - se erro, nao e seguidor.
 * Ou usar `/me/tags` pra ver tags da conta.
 */

// ============================================================
// Subscribe page to webhooks
// ============================================================
export async function igSubscribePageWebhooks(opts: {
  page_id: string;
  page_access_token: string;
}) {
  return fetchIG(
    `${opts.page_id}/subscribed_apps`,
    opts.page_access_token,
    {
      method: "POST",
      body: JSON.stringify({
        subscribed_fields: "messages,messaging_postbacks,message_deliveries,message_reads,instagram_manage_messages,comments",
      }),
    }
  );
}
