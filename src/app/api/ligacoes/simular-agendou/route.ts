import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { findNextSlots } from "@/lib/google-calendar/client";
import { getValidToken } from "@/lib/google-calendar/token-manager";

export const maxDuration = 60;

/**
 * SIMULAÇÃO: finge que uma ligação terminou com "agendou" e dispara todo o fluxo pós:
 * 1. Busca 3 horários livres no Google Calendar
 * 2. Envia WhatsApp pro lead com os horários
 * 3. Notifica Rafa
 *
 * Útil pra testar o fluxo sem precisar de ligação real
 * GET pra facilitar teste direto no browser.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const telefone = url.searchParams.get("telefone") || "5581984576173";
  const nome = url.searchParams.get("nome") || "Rafa (teste)";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ erro: "envs ausentes" });
  }

  const supabase = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // pega o tenant_id de alguma ligação existente (sistema monotenant)
  const { data: qualquerLig } = await supabase.from("ligacoes")
    .select("tenant_id").limit(1).maybeSingle();
  const tenantId = qualquerLig?.tenant_id;
  if (!tenantId) return NextResponse.json({ erro: "Nenhum tenant encontrado" });

  const telLead = telefone.replace(/\D/g, "");
  const telFinal = telLead.startsWith("55") ? telLead : `55${telLead}`;
  const resultado = {
    tenant_id: tenantId,
    telefone: telFinal,
    nome,
    horarios_calendar: [] as string[],
    enviou_whatsapp_lead: false,
    notificou_rafa: false,
    erros: [] as string[],
  };

  // 1. Pega horários do Google Calendar
  let slotsLabel = "";
  try {
    const token = await getValidToken(tenantId);
    if (!token) {
      resultado.erros.push("Google Calendar não conectado — conecta em /configuracoes/calendar");
    } else {
      const slots = await findNextSlots(token.access_token, token.calendar_id, {
        durationMin: 15,
        count: 3,
      });
      slotsLabel = slots.map((s, i) => `${i + 1}) ${s.label}`).join("\n");
      resultado.horarios_calendar = slots.map((s) => s.label);
    }
  } catch (e: unknown) {
    resultado.erros.push(`Calendar: ${e instanceof Error ? e.message : "erro"}`);
  }

  // 2. Busca Z-API ativo
  const { data: zapi } = await supabase.from("whatsapp_numeros")
    .select("id,zapi_instance_id,zapi_token").eq("is_active", true).limit(1).maybeSingle();
  if (!zapi?.zapi_instance_id) {
    resultado.erros.push("Nenhum número Z-API ativo. Cadastre em /disparo.");
    return NextResponse.json(resultado);
  }

  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  const zapiBase = `https://api.z-api.io/instances/${zapi.zapi_instance_id}/token/${zapi.zapi_token}`;

  // 3. Envia WhatsApp pro lead
  const primeiroNome = nome.split(" ")[0];
  const mensagemLead = slotsLabel
    ? `Oi ${primeiroNome}! Aqui é do Grupo Nogueira 🙌\n\nValeu pela conversa agora! Conforme combinado, olha as janelas que o Rafa tem essa semana pra conversar 15 min:\n\n${slotsLabel}\n\nQual funciona melhor pra você?`
    : `Oi ${primeiroNome}! Aqui é do Grupo Nogueira. Valeu pela conversa! Me passa um horário bom essa semana que o Rafa te liga. Manhã ou tarde?`;

  try {
    const r = await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: telFinal, message: mensagemLead }),
    });
    if (r.ok) {
      resultado.enviou_whatsapp_lead = true;
      await supabase.from("disparo_mensagens").insert({
        tenant_id: tenantId,
        numero_id: zapi.id,
        telefone_destino: telFinal,
        nome_destino: nome,
        mensagem_texto: mensagemLead,
        status: "enviado",
        sent_at: new Date().toISOString(),
      });
    } else {
      resultado.erros.push(`Z-API lead: ${r.status} ${(await r.text()).slice(0, 100)}`);
    }
  } catch (e: unknown) {
    resultado.erros.push(`Lead: ${e instanceof Error ? e.message : "erro"}`);
  }

  // 4. Notifica Rafa
  const rafaPhone = (process.env.WHATSAPP_RAFA_PHONE || "5581984576173").replace(/\D/g, "");
  const msgRafa = `🧪 *SIMULAÇÃO de fluxo pós-ligação*\n\n👤 Lead: *${nome}*\n📱 Tel: ${telFinal}\n\n📅 Janelas enviadas pro lead:\n${slotsLabel || "(Calendar desconectado)"}\n\n⚠️ Quando o lead responder um horário aqui no WhatsApp, a IA vai te pedir confirmação antes de agendar. Responda SIM pra criar o evento no Calendar + enviar o link pro lead.`;

  try {
    const r = await fetch(`${zapiBase}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: rafaPhone, message: msgRafa }),
    });
    if (r.ok) {
      resultado.notificou_rafa = true;
    } else {
      resultado.erros.push(`Z-API Rafa: ${r.status}`);
    }
  } catch (e: unknown) {
    resultado.erros.push(`Rafa: ${e instanceof Error ? e.message : "erro"}`);
  }

  return NextResponse.json(resultado);
}
