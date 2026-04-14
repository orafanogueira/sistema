/**
 * Meta Messaging (Messenger / Instagram DM / WhatsApp Cloud API).
 * Requer: META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN de page/business,
 * webhook verify token + URL publica em /api/webhook/meta.
 */

const BASE = "https://graph.facebook.com";
const VERSION = process.env.META_API_VERSION || "v20.0";

export async function sendMessenger(recipientPsid: string, message: string, pageAccessToken: string) {
  const res = await fetch(`${BASE}/${VERSION}/me/messages?access_token=${pageAccessToken}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientPsid }, message: { text: message }, messaging_type: "RESPONSE" }),
  });
  if (!res.ok) throw new Error(`Messenger ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sendInstagramDM(recipientIgsid: string, message: string, pageAccessToken: string) {
  const res = await fetch(`${BASE}/${VERSION}/me/messages?access_token=${pageAccessToken}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientIgsid }, message: { text: message } }),
  });
  if (!res.ok) throw new Error(`Instagram DM ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sendWhatsAppCloud(to: string, message: string, phoneNumberId: string, accessToken: string) {
  const res = await fetch(`${BASE}/${VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }),
  });
  if (!res.ok) throw new Error(`WhatsApp Cloud ${res.status}: ${await res.text()}`);
  return res.json();
}

export function verifyMetaWebhook(mode: string | null, token: string | null, challenge: string | null) {
  const verify = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && token === verify) return challenge;
  return null;
}
