import { Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDisconnectButton } from "@/components/configuracoes/calendar-disconnect";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: token } = user
    ? await supabase
        .from("google_calendar_tokens")
        .select("email, updated_at, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  const conectado = Boolean(token);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Calendar className="h-7 w-7 text-cyan" /> Google Calendar
        </h1>
        <p className="text-muted-foreground">
          Conecte sua agenda pra IA agendar consultorias automaticamente com link do Google Meet.
        </p>
      </div>

      {params.success && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-semibold">Conectado com sucesso</div>
              {params.email && <div className="text-xs text-muted-foreground">{params.email}</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {params.error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div className="text-sm">
              Erro: {decodeURIComponent(params.error)}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status da conexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conectado ? (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-semibold">Conectado</div>
                  <div className="text-xs text-muted-foreground">{token?.email}</div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                A IA vai automaticamente:
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Verificar se o horário proposto pelo lead está livre</li>
                  <li>Criar evento com link do Google Meet (15 minutos)</li>
                  <li>Enviar link direto pro lead no WhatsApp</li>
                  <li>Sugerir os 3 próximos horários livres caso o proposto esteja ocupado</li>
                </ul>
              </div>
              <CalendarDisconnectButton />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <div className="font-semibold">Não conectado</div>
                  <div className="text-xs text-muted-foreground">
                    Conecte pra IA agendar automaticamente
                  </div>
                </div>
              </div>
              <a href="/api/google-calendar/connect">
                <Button className="w-full">
                  <Calendar className="h-4 w-4" /> Conectar Google Calendar
                </Button>
              </a>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configuração (uma vez só)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>Pra funcionar, precisa ter configurado no Vercel:</p>
          <pre className="bg-background/60 rounded p-2 text-[11px]">
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=https://sistema.gruponogueiramkt.com
          </pre>
          <p className="pt-2">
            Pra criar o OAuth Client ID: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-cyan hover:underline">console.cloud.google.com/apis/credentials</a>
          </p>
          <p>
            → Criar credenciais → ID do cliente OAuth → Aplicativo da Web<br />
            → Authorized redirect URIs: <code className="text-cyan">{`{NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`}</code><br />
            → Habilitar Google Calendar API na biblioteca
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
