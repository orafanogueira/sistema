import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { refreshAccessToken } from "./client";

/** Busca token válido (refresh se expirado) pra um tenant */
export async function getValidToken(tenantId: string) {
  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: token } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!token) return null;

  const expiresAt = new Date(token.expires_at).getTime();
  const agora = Date.now();
  const margem = 5 * 60 * 1000; // 5 min

  if (expiresAt - agora < margem) {
    // precisa refresh
    try {
      const fresh = await refreshAccessToken(token.refresh_token);
      const novoExpires = new Date(Date.now() + fresh.expires_in * 1000);
      await supabase
        .from("google_calendar_tokens")
        .update({
          access_token: fresh.access_token,
          expires_at: novoExpires.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", token.id);
      return {
        access_token: fresh.access_token,
        calendar_id: token.calendar_id || "primary",
        email: token.email,
      };
    } catch (e) {
      console.error("Refresh Google falhou:", e);
      return null;
    }
  }

  return {
    access_token: token.access_token,
    calendar_id: token.calendar_id || "primary",
    email: token.email,
  };
}
