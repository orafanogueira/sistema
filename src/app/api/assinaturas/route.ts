import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasCreateCustomer, asaasFindCustomerByCpfCnpj, asaasCreateSubscription } from "@/lib/billing/asaas";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  let q = supabase.from("assinaturas").select("*,cliente:clientes(nome)").eq("active", true).order("created_at", { ascending: false });
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
  const { cliente_id, descricao, valor_mensal, ciclo, dia_vencimento, forma_pagamento, cpf_cnpj, contrato_id } = body;

  const { data: cliente } = await supabase.from("clientes")
    .select("nome,contato_email,contato_whatsapp").eq("id", cliente_id).maybeSingle();
  if (!cliente) return new NextResponse("cliente nao encontrado", { status: 404 });

  try {
    const cpfCnpjClean = (cpf_cnpj || "").replace(/\D/g, "");
    let customer = cpfCnpjClean ? await asaasFindCustomerByCpfCnpj(cpfCnpjClean) : null;
    if (!customer) {
      customer = await asaasCreateCustomer({
        name: cliente.nome, email: cliente.contato_email,
        mobilePhone: cliente.contato_whatsapp, cpfCnpj: cpfCnpjClean,
        externalReference: cliente_id,
      });
    }

    // proxima data (dia do mes)
    const hoje = new Date();
    const dia = Math.min(dia_vencimento || 10, 28);
    let proxima = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (proxima <= hoje) proxima = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);

    const billingType = (forma_pagamento?.toUpperCase() === "PIX" ? "PIX" :
                        forma_pagamento?.toUpperCase() === "BOLETO" ? "BOLETO" :
                        forma_pagamento?.toUpperCase() === "CREDIT_CARD" ? "CREDIT_CARD" : "UNDEFINED") as "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

    const sub = await asaasCreateSubscription({
      customer: customer.id,
      billingType,
      value: Number(valor_mensal),
      nextDueDate: proxima.toISOString().slice(0, 10),
      cycle: (ciclo as "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY") || "MONTHLY",
      description: descricao,
      externalReference: cliente_id,
    });

    const { data: assinatura, error } = await supabase.from("assinaturas").insert({
      tenant_id: m.tenant_id, cliente_id, contrato_id: contrato_id || null,
      descricao, valor_mensal: Number(valor_mensal),
      ciclo: ciclo || "MONTHLY", dia_vencimento: dia,
      forma_pagamento: billingType.toLowerCase(),
      asaas_subscription_id: sub.id,
      active: true, data_inicio: new Date().toISOString().slice(0, 10),
    }).select().single();

    if (error) return new NextResponse(error.message, { status: 400 });
    return NextResponse.json(assinatura);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
