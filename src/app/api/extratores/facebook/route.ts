import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFacebookGroupMembers } from "@/lib/extratores/apify";

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { group_url, max_members } = await req.json();
  if (!group_url) return new NextResponse("group_url obrigatório", { status: 400 });

  try {
    const members = await extractFacebookGroupMembers(group_url, max_members || 500);
    return NextResponse.json({ members, total: members.length });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
