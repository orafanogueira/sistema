/**
 * Google OAuth helpers - unico fluxo para Ads/GA4/GTM/Calendar/Gmail.
 */
import { google } from "googleapis";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function googleOauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function googleAuthUrl(state: string) {
  return googleOauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
  });
}

export async function googleExchangeCode(code: string) {
  const client = googleOauthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function gmailSend(opts: {
  refreshToken: string;
  to: string; subject: string; html: string; from?: string;
}) {
  const client = googleOauthClient();
  client.setCredentials({ refresh_token: opts.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: client });
  const raw = Buffer.from(
    [
      `From: ${opts.from || "me"}`,
      `To: ${opts.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString("base64")}?=`,
      "Content-Type: text/html; charset=utf-8",
      "",
      opts.html,
    ].join("\r\n")
  ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

export async function calendarCreateEvent(opts: {
  refreshToken: string;
  calendarId?: string;
  summary: string; description?: string;
  startIso: string; endIso: string;
  attendees?: string[];
}) {
  const client = googleOauthClient();
  client.setCredentials({ refresh_token: opts.refreshToken });
  const cal = google.calendar({ version: "v3", auth: client });
  return cal.events.insert({
    calendarId: opts.calendarId || "primary",
    requestBody: {
      summary: opts.summary, description: opts.description,
      start: { dateTime: opts.startIso }, end: { dateTime: opts.endIso },
      attendees: opts.attendees?.map((email) => ({ email })),
    },
  });
}
