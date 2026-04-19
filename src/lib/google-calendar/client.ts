/**
 * Google Calendar API — OAuth + agendamento
 * Docs: https://developers.google.com/calendar/api/v3/reference
 *
 * ENV obrigatórias:
 * - GOOGLE_OAUTH_CLIENT_ID
 * - GOOGLE_OAUTH_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL (ex: https://sistema.gruponogueiramkt.com)
 */

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID ausente");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!r.ok) throw new Error(`OAuth exchange falhou: ${r.status} ${await r.text()}`);
  return r.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!r.ok) throw new Error(`Refresh falhou: ${r.status}`);
  return r.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getUserEmail(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.email || null;
  } catch {
    return null;
  }
}

/** Lista eventos num intervalo — usa pra verificar disponibilidade */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<Array<{ id: string; start: string; end: string; summary?: string }>> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`listEvents ${r.status}: ${await r.text()}`);

  const data = await r.json();
  return (data.items || []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    start: (e.start as Record<string, string>).dateTime || (e.start as Record<string, string>).date,
    end: (e.end as Record<string, string>).dateTime || (e.end as Record<string, string>).date,
    summary: e.summary as string | undefined,
  }));
}

interface CreateEventOpts {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  attendees?: string[]; // emails
  createMeetLink?: boolean;
  timezone?: string;
}

/** Cria evento no calendário (com link Google Meet opcional) */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  opts: CreateEventOpts
) {
  const body: Record<string, unknown> = {
    summary: opts.summary,
    description: opts.description,
    start: { dateTime: opts.startISO, timeZone: opts.timezone || "America/Sao_Paulo" },
    end: { dateTime: opts.endISO, timeZone: opts.timezone || "America/Sao_Paulo" },
  };

  if (opts.attendees && opts.attendees.length > 0) {
    body.attendees = opts.attendees.map((email) => ({ email }));
  }

  if (opts.createMeetLink) {
    body.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  if (opts.createMeetLink) url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`createEvent ${r.status}: ${await r.text()}`);

  const data = await r.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink,
    meetLink: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri,
    start: data.start?.dateTime,
    end: data.end?.dateTime,
  };
}

/** Encontra próximos N slots livres em horário comercial (9-18h, seg-sex) */
export async function findNextSlots(
  accessToken: string,
  calendarId: string,
  opts: {
    durationMin?: number;
    count?: number;
    daysAhead?: number;
    startHour?: number;
    endHour?: number;
  } = {}
): Promise<Array<{ startISO: string; label: string }>> {
  const duration = opts.durationMin || 15;
  const count = opts.count || 3;
  const daysAhead = opts.daysAhead || 7;
  const startHour = opts.startHour || 9;
  const endHour = opts.endHour || 18;

  const now = new Date();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const busy = await listEvents(accessToken, calendarId, now.toISOString(), timeMax.toISOString());

  const slots: Array<{ startISO: string; label: string }> = [];
  const candidate = new Date(now);
  candidate.setMinutes(0, 0, 0);
  // arredonda pra próxima hora cheia + 1h de colchão
  candidate.setHours(candidate.getHours() + 2);

  const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const DIAS_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  while (slots.length < count && candidate < timeMax) {
    const day = candidate.getDay();
    const hour = candidate.getHours();

    // pula fim de semana e fora do horário comercial
    if (day === 0 || day === 6 || hour < startHour || hour >= endHour) {
      // pula pro próximo dia útil às startHour
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(startHour, 0, 0, 0);
      continue;
    }

    const slotEnd = new Date(candidate.getTime() + duration * 60 * 1000);

    // verifica se há conflito com algum evento busy
    const conflito = busy.some((ev) => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return candidate < evEnd && slotEnd > evStart;
    });

    if (!conflito) {
      const diaLabel = DIAS_FULL[day];
      const dataStr = `${candidate.getDate().toString().padStart(2, "0")}/${(candidate.getMonth() + 1).toString().padStart(2, "0")}`;
      const horaStr = `${hour.toString().padStart(2, "0")}h${candidate.getMinutes() > 0 ? candidate.getMinutes().toString().padStart(2, "0") : ""}`;
      slots.push({
        startISO: candidate.toISOString(),
        label: `${diaLabel} ${dataStr} às ${horaStr}`,
      });
    }

    // avança 30 min
    candidate.setMinutes(candidate.getMinutes() + 30);
  }

  return slots;
}

/** Parseia expressão de horário livre do lead (ex: "terça 14h", "amanhã 10h30", "dia 25 às 15h") */
export function parseHorarioBR(texto: string, baseDate?: Date): Date | null {
  const base = baseDate || new Date();
  const t = texto.toLowerCase().trim();

  // extrai hora: "14h", "14h30", "14:30", "às 14"
  const horaMatch = t.match(/(\d{1,2})(?:[h:](\d{2}))?/);
  if (!horaMatch) return null;
  const hora = parseInt(horaMatch[1]);
  const minuto = horaMatch[2] ? parseInt(horaMatch[2]) : 0;
  if (hora < 0 || hora > 23 || minuto > 59) return null;

  const resultado = new Date(base);
  resultado.setSeconds(0, 0);

  // dias da semana
  const diasMap: Record<string, number> = {
    "domingo": 0, "segunda": 1, "terça": 2, "terca": 2,
    "quarta": 3, "quinta": 4, "sexta": 5, "sábado": 6, "sabado": 6,
  };
  for (const [dia, num] of Object.entries(diasMap)) {
    if (t.includes(dia)) {
      const hoje = base.getDay();
      let offset = num - hoje;
      if (offset <= 0) offset += 7; // próxima ocorrência
      resultado.setDate(base.getDate() + offset);
      resultado.setHours(hora, minuto, 0, 0);
      return resultado;
    }
  }

  // "amanhã"
  if (t.includes("amanhã") || t.includes("amanha")) {
    resultado.setDate(base.getDate() + 1);
    resultado.setHours(hora, minuto, 0, 0);
    return resultado;
  }

  // "hoje"
  if (t.includes("hoje")) {
    resultado.setHours(hora, minuto, 0, 0);
    return resultado;
  }

  // "dia 25"
  const diaMatch = t.match(/dia (\d{1,2})/);
  if (diaMatch) {
    const dia = parseInt(diaMatch[1]);
    resultado.setDate(dia);
    // se dia já passou esse mês, joga pro próximo
    if (resultado < base) resultado.setMonth(resultado.getMonth() + 1);
    resultado.setHours(hora, minuto, 0, 0);
    return resultado;
  }

  return null;
}
