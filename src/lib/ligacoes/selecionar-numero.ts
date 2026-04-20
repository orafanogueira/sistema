/**
 * Seleciona qual número Vapi usar baseado no país do telefone destinatário.
 * Detecta país pelo prefixo do número (E.164).
 */

import { createClient as createAdmin } from "@supabase/supabase-js";

export function detectCountryFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // BR: 55 (13 dígitos: 55 + DDD + 9 + 8)
  if (digits.startsWith("55") && digits.length >= 12) return "BR";
  // US/Canada: 1 (11 dígitos)
  if (digits.startsWith("1") && digits.length === 11) return "US";
  // MX: 52
  if (digits.startsWith("52")) return "MX";
  // UK: 44
  if (digits.startsWith("44")) return "UK";
  // Portugal: 351
  if (digits.startsWith("351")) return "PT";
  // Espanha: 34
  if (digits.startsWith("34")) return "ES";
  // fallback: BR (mais comum no sistema)
  if (digits.length === 10 || digits.length === 11) return "BR";
  return "UNKNOWN";
}

export async function pegarNumeroVapi(
  tenantId: string,
  telefoneDestinatario: string
): Promise<{ phoneNumberId: string; numeroId?: string; fonte: "banco" | "env" } | null> {
  const pais = detectCountryFromPhone(telefoneDestinatario);

  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // 1ª tentativa: número ativo pro país específico
  const { data: matchPais } = await supabase.from("vapi_numeros")
    .select("id, vapi_phone_number_id")
    .eq("tenant_id", tenantId)
    .eq("country_code", pais)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (matchPais) {
    return {
      phoneNumberId: matchPais.vapi_phone_number_id,
      numeroId: matchPais.id,
      fonte: "banco",
    };
  }

  // 2ª tentativa: número default do tenant
  const { data: def } = await supabase.from("vapi_numeros")
    .select("id, vapi_phone_number_id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (def) {
    return {
      phoneNumberId: def.vapi_phone_number_id,
      numeroId: def.id,
      fonte: "banco",
    };
  }

  // 3ª tentativa: env var global (fallback legado)
  const envId = process.env.VAPI_PHONE_NUMBER_ID;
  if (envId) {
    return { phoneNumberId: envId, fonte: "env" };
  }

  return null;
}
