import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CONTRATO_TEMPLATES, getTemplate, renderTemplate } from "@/lib/contratos/templates";
import { runAgent } from "@/lib/ai-agents/runner";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("contratos")
    .select("*,cliente:clientes(nome),signatarios:contrato_signatarios(nome,email,signed_at)")
    .order("created_at", { ascending: false });
  if (cliente_id) q = q.eq("cliente_id", cliente_id);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const { data: m } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!m) return new NextResponse("sem tenant", { status: 400 });

  const body = await req.json();
  const { template_key, cliente_id, titulo, campos, signatarios, valor, forma_pagamento, parcelas, data_inicio, data_fim, use_ai, ai_prompt } = body;

  let contratoBody = "";
  let generated_by_agent: string | null = null;

  if (use_ai) {
    // Agente IA gera corpo do contrato a partir de prompt livre
    const run = await runAgent(supabase, m.tenant_id, cliente_id || null, user.id, {
      agent_key: "comercial_qualificacao", // placeholder se nao houver agent_key contrato
      input: {
        instrucao: ai_prompt || "Gere um contrato de prestacao de servico profissional completo.",
        campos: campos || {},
      },
    });
    contratoBody = run.output;
    generated_by_agent = "ai_contrato";
  } else if (template_key) {
    const tpl = getTemplate(template_key);
    if (!tpl) return new NextResponse("template invalido", { status: 400 });
    contratoBody = renderTemplate(tpl.body, campos || {});
  } else if (body.body) {
    contratoBody = body.body;
  } else {
    return new NextResponse("informe template_key, use_ai ou body", { status: 400 });
  }

  const { data: contrato, error } = await supabase.from("contratos").insert({
    tenant_id: m.tenant_id,
    cliente_id: cliente_id || null,
    titulo,
    body: contratoBody,
    status: "pronto",
    valor: valor || null,
    forma_pagamento: forma_pagamento || null,
    parcelas: parcelas || 1,
    data_inicio: data_inicio || null,
    data_fim: data_fim || null,
    campos_preenchidos: campos || {},
    generated_by_agent,
    created_by: user.id,
  }).select().single();

  if (error) return new NextResponse(error.message, { status: 400 });

  // Persist signatarios
  if (Array.isArray(signatarios)) {
    await supabase.from("contrato_signatarios").insert(
      signatarios.map((s: { nome: string; email: string; cpf?: string; telefone?: string; role?: string }) => ({
        contrato_id: contrato.id,
        nome: s.nome, email: s.email, cpf: s.cpf, telefone: s.telefone,
        role: s.role || "contratante",
      }))
    );
  }

  await supabase.from("contrato_eventos").insert({
    contrato_id: contrato.id, type: "created", actor: user.id,
  });

  return NextResponse.json(contrato);
}
