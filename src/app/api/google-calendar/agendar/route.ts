import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getValidToken } from "@/lib/google-calendar/token-manager";
import { createEvent, findNextSlots, listEvents, parseHorarioBR } from "@/lib/google-calendar/client";

export const maxDuration = 60;

/**
 * Chamado pela IA de autoatendimento quando detecta intenção de agendamento.
 * Body:
 * {
 *   tenant_id: string,
 *   horario_texto?: string,     // "terça 14h" — se enviado, tenta agendar direto
 *   lead_nome: string,
 *   lead_telefone: string,
 *   lead_email?: string,
 *   lead_id?: string,
 *   mensagem_id?: string,
 *   duracao_min?: number,       // default 15
 * }
 *
 * Retorna:
 * - { agendado: true, meet_link, data_hora, mensagem_pro_lead }
 * - { agendado: false, proximos_slots: [...], mensagem_pro_lead }
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    tenant_id,
    horario_texto,
    lead_nome,
    lead_telefone,
    lead_email,
    lead_id,
    mensagem_id,
    duracao_min = 15,
  } = body;

  if (!tenant_id || !lead_nome || !lead_telefone) {
    return NextResponse.json({ erro: "tenant_id, lead_nome e lead_telefone obrigatórios" }, { status: 400 });
  }

  const token = await getValidToken(tenant_id);
  if (!token) {
    return NextResponse.json({
      agendado: false,
      erro: "Google Calendar não conectado. Conecte em /configuracoes/calendar",
    });
  }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // se lead mandou um horário específico → tenta agendar
  if (horario_texto) {
    const dataHora = parseHorarioBR(horario_texto);
    if (dataHora) {
      const fim = new Date(dataHora.getTime() + duracao_min * 60 * 1000);

      // verifica conflito
      const eventos = await listEvents(
        token.access_token,
        token.calendar_id,
        dataHora.toISOString(),
        fim.toISOString()
      );

      if (eventos.length === 0) {
        // horário livre — cria evento
        const attendees = lead_email ? [lead_email] : [];

        try {
          const evento = await createEvent(token.access_token, token.calendar_id, {
            summary: `Consultoria Rafa Nogueira x ${lead_nome}`,
            description: `Consultoria gratuita de ${duracao_min} minutos.\n\nLead: ${lead_nome}\nTelefone: ${lead_telefone}`,
            startISO: dataHora.toISOString(),
            endISO: fim.toISOString(),
            attendees,
            createMeetLink: true,
          });

          // registra agendamento
          await supabase.from("agendamentos_ia").insert({
            tenant_id,
            lead_id: lead_id || null,
            mensagem_id: mensagem_id || null,
            telefone: lead_telefone,
            lead_nome,
            data_hora: dataHora.toISOString(),
            duracao_min,
            meet_link: evento.meetLink,
            gcal_event_id: evento.id,
            status: "agendado",
          });

          const diaLabel = dataHora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
          const horaLabel = dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

          const mensagemProLead = `Agendado ✅\n\nConsultoria ${diaLabel} às ${horaLabel}\nLink da call: ${evento.meetLink}\n\nQualquer coisa me chama aqui. Até lá! 🚀`;

          return NextResponse.json({
            agendado: true,
            data_hora: dataHora.toISOString(),
            meet_link: evento.meetLink,
            gcal_event_id: evento.id,
            mensagem_pro_lead: mensagemProLead,
          });
        } catch (e: unknown) {
          return NextResponse.json({
            agendado: false,
            erro_criacao: e instanceof Error ? e.message : "erro",
          });
        }
      }
      // se tem conflito → cai na lógica de sugerir próximos slots abaixo
    }
  }

  // retorna próximos 3 slots livres
  const slots = await findNextSlots(token.access_token, token.calendar_id, {
    durationMin: duracao_min,
    count: 3,
  });

  const listaSlots = slots.map((s, i) => `${i + 1}) ${s.label}`).join("\n");
  const mensagemProLead = horario_texto
    ? `Esse horário tá ocupado pra mim. Tenho essas janelas disponíveis:\n\n${listaSlots}\n\nQual funciona melhor?`
    : `Tenho essas janelas abertas essa semana:\n\n${listaSlots}\n\nQual encaixa melhor pra você?`;

  return NextResponse.json({
    agendado: false,
    proximos_slots: slots,
    mensagem_pro_lead: mensagemProLead,
  });
}
