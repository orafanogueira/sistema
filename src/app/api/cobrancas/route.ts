import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasCreateCustomer, asaasFindCustomerByCpfCnpj, asaasCreatePayment, asaasGetPixQrCode } from "@/lib/billing/asaas";

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const cliente_id = url.searchParams.get("cliente_id");
  const status = url.searchParams.get("status");
  let q = supabase.from("cobrancas")
    .select("*,cliente:clientes(nome,contato_whatsapp,contato_email)")
    .order("due_date", { ascending: false });
  if (cliente_id) q = q.eq("cliente_id", cliente_id);
  if (status) q = q.eq("status", status);
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
  const { cliente_id, descricao, valor, due_date, forma_pagamento, contrato_id } = body;

  // Busca dados do cliente pra Asaas
  const { data: cliente } = await supabase.from("clientes")
    .select("id,nome,contato_email,contato_whatsapp").eq("id", cliente_id).maybeSingle();
  if (!cliente) return new NextResponse("cliente nao encontrado", { status: 404 });

  try {
    // Encontra ou cria customer no Asaas
    const cpfCnpj = (body.cpf_cnpj || "").replace(/\D/g, "");
    let customer = cpfCnpj ? await asaasFindCustomerByCpfCnpj(cpfCnpj) : null;
    if (!customer) {
      customer = await asaasCreateCustomer({
        name: cliente.nome,
        email: cliente.contato_email || undefined,
        mobilePhone: cliente.contato_whatsapp || undefined,
        cpfCnpj: cpfCnpj || undefined,
        externalReference: cliente.id,
      });
    }

    // Cria pagamento
    const billingType = (forma_pagamento?.toUpperCase() === "PIX" ? "PIX" :
                        forma_pagamento?.toUpperCase() === "BOLETO" ? "BOLETO" :
                        forma_pagamento?.toUpperCase() === "CREDIT_CARD" ? "CREDIT_CARD" : "UNDEFINED") as "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

    const payment = await asaasCreatePayment({
      customer: customer.id,
      billingType,
      value: Number(valor),
      dueDate: due_date,
      description: descricao,
      externalReference: cliente.id,
    });

    // Se for PIX, pega QR code
    let pix_copy_paste: string | null = null;
    let pix_qrcode_image: string | null = null;
    if (billingType === "PIX") {
      try {
        const qr = await asaasGetPixQrCode(payment.id);
        pix_copy_paste = qr.payload;
        pix_qrcode_image = qr.encodedImage;
      } catch { /* ignora */ }
    }

    const { data: cobranca, error } = await supabase.from("cobrancas").insert({
      tenant_id: m.tenant_id,
      cliente_id,
      contrato_id: contrato_id || null,
      descricao, valor: Number(valor),
      forma_pagamento: billingType.toLowerCase() as "pix" | "boleto" | "credit_card" | "undefined",
      status: "pendente",
      due_date,
      asaas_payment_id: payment.id,
      asaas_invoice_url: payment.invoiceUrl,
      asaas_bank_slip_url: payment.bankSlipUrl,
      pix_copy_paste, pix_qrcode_image,
    }).select().single();

    if (error) return new NextResponse(error.message, { status: 400 });
    return NextResponse.json(cobranca);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
