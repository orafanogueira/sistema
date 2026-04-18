import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 600;

/**
 * Dispara mensagens de uma campanha.
 * Processa a fila respeitando: rotação de números, rate limit, intervalo aleatório.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { campanha_id } = await req.json();
  if (!campanha_id) return new NextResponse("campanha_id obrigatório", { status: 400 });

  const { data: campanha } = await supabase.from("disparo_campanhas")
    .select("*").eq("id", campanha_id).maybeSingle();
  if (!campanha) return new NextResponse("campanha não encontrada", { status: 404 });

  // pega mensagens pendentes
  const { data: mensagens } = await supabase.from("disparo_mensagens")
    .select("*")
    .eq("campanha_id", campanha_id)
    .eq("status", "pendente")
    .order("position").limit(10);

  if (!mensagens || mensagens.length === 0) {
    return NextResponse.json({ enviadas: 0, message: "Nenhuma mensagem pendente" });
  }

  // pega números
  const { data: numeros } = await supabase.from("whatsapp_numeros")
    .select("*").eq("is_active", true);

  if (!numeros || numeros.length === 0) {
    return new NextResponse("Nenhum número WhatsApp cadastrado", { status: 400 });
  }

  let enviadas = 0;
  let erros = 0;
  let numIdx = 0;

  // atualiza campanha pra "ativa"
  await supabase.from("disparo_campanhas").update({ status: "ativa" }).eq("id", campanha_id);

  for (const msg of mensagens) {
    // seleciona número por rotação
    const numero = numeros[numIdx % numeros.length];
    numIdx++;

    // verifica rate limit do número
    if (numero.msgs_enviadas_hoje >= numero.max_por_dia) {
      numIdx++; // pula pro próximo
      continue;
    }

    try {
      // envia via Z-API
      if (!numero.zapi_instance_id || !numero.zapi_token) {
        throw new Error("Número sem Z-API configurado");
      }

      const zapiUrl = `https://api.z-api.io/instances/${numero.zapi_instance_id}/token/${numero.zapi_token}/send-text`;
      const r = await fetch(zapiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: msg.telefone_destino.replace(/\D/g, ""),
          message: msg.texto_gerado,
        }),
      });

      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Z-API ${r.status}: ${txt.slice(0, 100)}`);
      }

      // sucesso
      await supabase.from("disparo_mensagens").update({
        status: "enviado",
        numero_id: numero.id,
        sent_at: new Date().toISOString(),
      }).eq("id", msg.id);

      await supabase.from("whatsapp_numeros").update({
        msgs_enviadas_hoje: (numero.msgs_enviadas_hoje || 0) + 1,
        ultimo_envio_at: new Date().toISOString(),
      }).eq("id", numero.id);

      enviadas++;
    } catch (e: unknown) {
      await supabase.from("disparo_mensagens").update({
        status: "erro",
        error_message: e instanceof Error ? e.message : "erro",
      }).eq("id", msg.id);
      erros++;
    }

    // intervalo aleatório entre mensagens (anti-ban)
    // intervalo 5-15s (cabe no Vercel: 10 msgs × 15s = 150s < 600s timeout)
    const delay = Math.floor(Math.random() * 11) + 5;
    await new Promise((r) => setTimeout(r, delay * 1000));
  }

  // atualiza contadores da campanha
  await supabase.from("disparo_campanhas").update({
    total_enviadas: (campanha.total_enviadas || 0) + enviadas,
    total_erros: (campanha.total_erros || 0) + erros,
    status: enviadas + erros >= mensagens.length ? "concluida" : "ativa",
  }).eq("id", campanha_id);

  return NextResponse.json({ enviadas, erros, total: mensagens.length });
}
