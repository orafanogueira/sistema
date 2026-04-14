/**
 * Cliente API Asaas - cobrancas, assinaturas, clientes.
 * Docs: https://docs.asaas.com/
 *
 * Sandbox: https://sandbox.asaas.com/api/v3
 * Producao: https://api.asaas.com/v3
 */

function getBase() {
  return process.env.ASAAS_BASE_URL ||
    (process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3");
}
function getKey() {
  const k = process.env.ASAAS_API_KEY;
  if (!k) throw new Error("ASAAS_API_KEY ausente nas env vars");
  return k;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      access_token: getKey(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

// ============================================================
// CUSTOMERS
// ============================================================
export interface AsaasCustomer {
  id: string; name: string; email?: string; mobilePhone?: string;
  cpfCnpj?: string; postalCode?: string; address?: string; addressNumber?: string;
}

export async function asaasCreateCustomer(data: {
  name: string; email?: string; cpfCnpj?: string; mobilePhone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch("/customers", { method: "POST", body: JSON.stringify(data) });
}

export async function asaasFindCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const res = await asaasFetch<{ data: AsaasCustomer[] }>(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`);
  return res.data[0] || null;
}

// ============================================================
// PAYMENTS (cobranca unica)
// ============================================================
export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasPayment {
  id: string; customer: string; value: number; dueDate: string;
  billingType: AsaasBillingType; status: string; invoiceUrl?: string;
  bankSlipUrl?: string; description?: string;
  pixTransaction?: string; externalReference?: string;
}

export async function asaasCreatePayment(data: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;             // yyyy-mm-dd
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
}): Promise<AsaasPayment> {
  return asaasFetch("/payments", { method: "POST", body: JSON.stringify(data) });
}

/** Pega QR Code PIX do pagamento (nome, imagem base64, copia-cola). */
export async function asaasGetPixQrCode(paymentId: string): Promise<{
  encodedImage: string; payload: string; expirationDate: string;
}> {
  return asaasFetch(`/payments/${paymentId}/pixQrCode`);
}

export async function asaasGetPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch(`/payments/${paymentId}`);
}

export async function asaasCancelPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch(`/payments/${paymentId}`, { method: "DELETE" });
}

// ============================================================
// SUBSCRIPTIONS (cobranca recorrente)
// ============================================================
export type AsaasCycle = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";

export interface AsaasSubscription {
  id: string; customer: string; value: number; cycle: AsaasCycle;
  nextDueDate: string; status: string; description?: string;
}

export async function asaasCreateSubscription(data: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: AsaasCycle;
  description?: string;
  externalReference?: string;
  endDate?: string;
}): Promise<AsaasSubscription> {
  return asaasFetch("/subscriptions", { method: "POST", body: JSON.stringify(data) });
}

export async function asaasCancelSubscription(id: string) {
  return asaasFetch(`/subscriptions/${id}`, { method: "DELETE" });
}

// ============================================================
// WEBHOOK
// ============================================================
export interface AsaasWebhookEvent {
  event: string;                      // PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, etc
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
}
