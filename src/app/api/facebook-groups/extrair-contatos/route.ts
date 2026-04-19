import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFacebookGroupMembers } from "@/lib/extratores/apify";

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { group_url, max }: { group_url: string; max?: number } = await req.json();
  if (!group_url) return new NextResponse("group_url obrigatório", { status: 400 });

  try {
    const members = await extractFacebookGroupMembers(group_url, max || 100);

    // contatos no formato que o modal de disparo espera
    const contatos = members.map((m) => ({
      phone: m.phone,
      telefone: m.phone,
      email: m.email,
      nome: m.name,
      biography: m.postContent,
    }));

    return NextResponse.json({
      group_url,
      total: contatos.length,
      contatos,
      with_email: contatos.filter((c) => c.email).length,
      with_phone: contatos.filter((c) => c.phone).length,
      active_posters: members.filter((m) => (m.totalPosts || 0) > 0).length,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      erro: e instanceof Error ? e.message : "erro",
      group_url,
    }, { status: 400 });
  }
}
