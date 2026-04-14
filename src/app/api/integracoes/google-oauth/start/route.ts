import { NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/integrations/google-oauth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cliente = url.searchParams.get("cliente") || "";
  const state = Buffer.from(JSON.stringify({ cliente })).toString("base64url");
  return NextResponse.redirect(googleAuthUrl(state));
}
