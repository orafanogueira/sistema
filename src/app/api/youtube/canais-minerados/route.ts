import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("youtube_canais_minerados")
    .select("id,channel_name")
    .order("score_oportunidade", { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}
