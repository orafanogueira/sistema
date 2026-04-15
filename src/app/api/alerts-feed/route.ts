import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("alerts")
    .select("id,type,severity,title,message,created_at,is_read,cliente_id")
    .eq("is_resolved", false)
    .order("created_at", { ascending: false }).limit(20);
  return NextResponse.json(data || []);
}
