import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { campanha_id } = await req.json();
  if (!campanha_id) return new NextResponse("campanha_id obrigatório", { status: 400 });

  const { data: campanha } = await supabase.from("email_campanhas")
    .select("*").eq("id", campanha_id).maybeSingle();
  if (!campanha) return new NextResponse("campanha não encontrada", { status: 404 });

  const { data: mensagens } = await supabase.from("email_mensagens")
    .select("*")
    .eq("campanha_id", campanha_id)
    .eq("status", "pendente")
    .order("position").limit(20);

  if (!mensagens || mensagens.length === 0) {
    return NextResponse.json({ enviados: 0, message: "Nenhum email pendente" });
  }

  await supabase.from("email_campanhas").update({ status: "ativa" }).eq("id", campanha_id);

  let enviados = 0;
  let erros = 0;

  for (const msg of mensagens) {
    const result = await sendEmail({
      to: msg.email_destino,
      subject: msg.assunto,
      html: msg.corpo_html,
      from: `${campanha.from_name || "Grupo Nogueira"} <${campanha.from_email || "contato@gruponogueiramkt.com"}>`,
    });

    if (result.sent) {
      await supabase.from("email_mensagens").update({
        status: "enviado",
        sent_at: new Date().toISOString(),
      }).eq("id", msg.id);
      enviados++;
    } else {
      await supabase.from("email_mensagens").update({
        status: "erro",
        error_message: result.error || "erro desconhecido",
      }).eq("id", msg.id);
      erros++;
    }

    // delay 1s entre emails (Resend rate limit: 10/s no free tier)
    await new Promise((r) => setTimeout(r, 1000));
  }

  await supabase.from("email_campanhas").update({
    total_enviados: (campanha.total_enviados || 0) + enviados,
    total_erros: (campanha.total_erros || 0) + erros,
    status: enviados + erros >= mensagens.length ? "concluida" : "ativa",
  }).eq("id", campanha_id);

  return NextResponse.json({ enviados, erros, total: mensagens.length });
}
