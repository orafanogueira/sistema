import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gerarRelatorioMensal } from "@/lib/relatorios/gerador";
import { ZAPIClient } from "@/lib/integrations/zapi";

/**
 * Cron - processa relatorios_agendados que tem next_send_at <= agora.
 * Gera relatorio, salva, envia via WhatsApp se configurado.
 * Schedule sugerido: 0 8 * * * (8h diario)
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: pendings } = await supabase
    .from("relatorios_agendados")
    .select("*,cliente:clientes(nome,contato_whatsapp)")
    .eq("is_active", true)
    .lte("next_send_at", now)
    .limit(20);

  let processed = 0;

  for (const r of pendings || []) {
    const cliente = r.cliente as { nome?: string; contato_whatsapp?: string } | null;
    try {
      // mes passado
      const hoje = new Date();
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const mes = `${mesPassado.getFullYear()}-${String(mesPassado.getMonth() + 1).padStart(2, "0")}`;

      const relatorio = await gerarRelatorioMensal({
        supabase, cliente_id: r.cliente_id,
        mes,
        config: {
          include_social: r.include_social, include_trafego: r.include_trafego,
          include_crm: r.include_crm, include_financeiro: r.include_financeiro,
        },
      });

      const { data: run } = await supabase.from("relatorios_runs").insert({
        relatorio_id: r.id, cliente_id: r.cliente_id,
        periodo_label: mes,
        content_html: relatorio.html,
        content_whatsapp: relatorio.whatsapp_text,
        status: "success",
      }).select().single();

      // Envio via WhatsApp
      const channels = r.channels as string[];
      const sentTo: string[] = [];
      if (channels?.includes("whatsapp") && cliente?.contato_whatsapp) {
        try {
          const zapi = new ZAPIClient();
          await zapi.sendText(cliente.contato_whatsapp, relatorio.whatsapp_text);
          sentTo.push(cliente.contato_whatsapp);
        } catch (e) {
          console.error("erro zapi:", e);
        }
      }

      if (sentTo.length > 0 && run) {
        await supabase.from("relatorios_runs").update({ sent_to: sentTo }).eq("id", run.id);
      }

      // Atualiza next_send_at pro proximo mes
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(Math.min(r.dia_do_mes, 28));
      await supabase.from("relatorios_agendados").update({
        last_sent_at: new Date().toISOString(),
        next_send_at: nextMonth.toISOString(),
      }).eq("id", r.id);

      processed++;
    } catch (e: unknown) {
      await supabase.from("relatorios_runs").insert({
        relatorio_id: r.id, cliente_id: r.cliente_id,
        status: "error", error: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({ processed });
}
