import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const debug = {
    env_supabase_url: !!supabaseUrl,
    env_service_key: !!serviceKey,
    service_key_prefix: serviceKey?.slice(0, 20) + "..." || "AUSENTE",
  };

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      ok: false,
      debug,
      erro: "Env vars ausentes no Vercel",
    });
  }

  try {
    const supabase = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error, count } = await supabase
      .from("ligacoes")
      .select("id, status, vapi_call_id, telefone, nome, tenant_id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      ok: !error,
      debug,
      total_na_tabela: count,
      ligacoes_retornadas: data?.length || 0,
      erro: error?.message,
      amostra: (data || []).map((l) => ({
        id: l.id.slice(0, 8),
        status: l.status,
        tem_vapi_id: !!l.vapi_call_id,
        vapi_id_prefix: l.vapi_call_id?.slice(0, 10),
        telefone: l.telefone,
        nome: l.nome,
        tenant_id: l.tenant_id?.slice(0, 8),
        created_at: l.created_at,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json({
      ok: false,
      debug,
      erro: e instanceof Error ? e.message : "erro",
    });
  }
}
