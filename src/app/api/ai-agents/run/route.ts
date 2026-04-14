import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/ai-agents/runner";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { agent_key, input, cliente_id, override_prompt, override_temperature } = body;
  if (!agent_key) return new NextResponse("agent_key obrigatorio", { status: 400 });

  // contexto do cliente se fornecido
  let cliente_context;
  if (cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes").select("nome,segmento,vertical,observacoes")
      .eq("id", cliente_id).maybeSingle();
    if (cliente) {
      cliente_context = {
        nome: cliente.nome,
        nicho: cliente.segmento || cliente.vertical,
      };
    }
  }

  try {
    const res = await runAgent(supabase, m.tenant_id, cliente_id || null, user.id, {
      agent_key, input: input || {}, cliente_context, override_prompt, override_temperature,
    });
    return NextResponse.json(res);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Erro IA", { status: 500 });
  }
}
