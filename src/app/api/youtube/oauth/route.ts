import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

/** GET: redireciona pro OAuth do Google/YouTube */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return new NextResponse("GOOGLE_OAUTH_CLIENT_ID ausente no Vercel", { status: 500 });

  const url = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const redirectUri = `${baseUrl}/api/youtube/oauth/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return NextResponse.redirect(authUrl.toString());
}
