import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.is_read === "boolean") update.is_read = body.is_read;
  if (typeof body.is_resolved === "boolean") {
    update.is_resolved = body.is_resolved;
    if (body.is_resolved) update.resolved_at = new Date().toISOString();
  }
  const { error } = await supabase.from("alerts").update(update).eq("id", id);
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true });
}
