# Fatia N - Contratos (Clicksign) + Billing (Asaas)

## O que entrou

### Banco (migration 005)
- `contratos` + `contrato_signatarios` + `contrato_eventos` + `contrato_templates`
- `cobrancas` (integrada com Asaas)
- `assinaturas` (recorrencia mensal/trimestral/anual) com MRR calculado automatico
- View `v_financeiro_resumo`

### Integracoes
- **Clicksign** (`src/lib/contratos/clicksign.ts`) - envelope, signatarios, notificacao
- **Asaas** (`src/lib/billing/asaas.ts`) - customer, payment (PIX/boleto/cartao), subscription
- **PDF Generator** (`src/lib/contratos/pdf.ts`) - texto -> PDF usando pdf-lib

### Templates de contrato (3 prontos)
- `agencia_marketing` - Prestacao servicos marketing digital
- `automotivo_consignacao` - Consignacao de veiculo
- `comercial_generico` - Prestacao servicos geral

### Endpoints
- `GET/POST /api/contratos` - listar/criar
- `GET/PATCH/DELETE /api/contratos/[id]` - detalhe
- `POST /api/contratos/[id]/enviar` - envia pra assinatura Clicksign
- `GET/POST /api/cobrancas` - listar/criar (cria cliente + payment no Asaas)
- `POST /api/cobrancas/[id]/enviar-wa` - envia PIX/boleto via Z-API
- `POST /api/webhook/clicksign` - eventos de assinatura
- `POST /api/webhook/asaas` - eventos de pagamento
- `GET /api/financeiro/dashboard` - KPIs consolidados

### UI
- `/contratos` - lista com filtros e status
- `/contratos/novo` - wizard 3 passos (cliente+template -> dados -> signatarios)
- `/contratos/[id]` - detalhe com body, signatarios, timeline, botao enviar assinatura
- `/cobrancas` - lista com botao WhatsApp
- `/financeiro` - dashboard MRR, ARR, receita, inadimplencia, previsao

### Sidebar
Nova secao **Financeiro** com: Financeiro, Contratos, Cobrancas.

---

## Setup — 3 passos

### 1. Rodar migration 005 no Supabase
SQL Editor > cole e rode `supabase/migrations/005_contratos_billing.sql`.

### 2. Configurar Clicksign

1. Acessa https://www.clicksign.com/
2. Cria conta (tem plano com 3 documentos/mes gratis pra testar)
3. Menu superior direito > **Minha conta** > **API**
4. Copia o **Token de acesso**
5. Na Vercel > Settings > Environment Variables adiciona:
   ```
   CLICKSIGN_TOKEN=<seu-token>
   CLICKSIGN_BASE_URL=https://app.clicksign.com
   ```
6. Marca Production, Preview, Development > Save
7. Na Clicksign > **Webhooks** > adiciona:
   ```
   URL: https://app.gruponogueiramkt.com/api/webhook/clicksign
   Eventos: document_signed, sign, refuse, deadline
   ```

### 3. Configurar Asaas

A key que voce me passou e **producao real** (`$aact_prod_...`). Cuidado:
- Todas as cobrancas vao ser REAIS e geradas no Asaas em producao
- Seus clientes recebem PIX/boleto de verdade
- Voce recebe o dinheiro de verdade no seu banco

**Recomendo fazer assim:**

**Opcao A (mais segura) — usar sandbox primeiro:**
1. Acessa https://sandbox.asaas.com/
2. Cria conta teste (gratuita)
3. Gera API key no sandbox (`$aact_hmlg_...`)
4. Testa tudo lá
5. Depois de validado, troca pra key de producao

**Opcao B (ir direto pra producao):**
Usa a key que voce ja tem. Mas antes:
- Cria 1 cobranca de R$ 1,00 de teste pra confirmar que chega certo
- Configura webhook antes de tudo

Variaveis na Vercel:
```
ASAAS_API_KEY=$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjUzM2Y3MzlmLWJmYzYtNDk1Zi1hMmE3LTg5MjIwNmFjOWQ2Mjo6JGFhY2hfM2U3YmIzNzctZGM4MS00MTg0LWFmZDYtNTg4NTYxNDZkYzU1
ASAAS_ENV=production
```

Webhook Asaas:
1. Dashboard Asaas > **Integracoes** > **Webhooks**
2. URL: `https://app.gruponogueiramkt.com/api/webhook/asaas`
3. Marca eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`
4. Salva

---

## Como usar (fluxo completo)

### Gerar contrato + enviar pra assinatura
1. `/contratos/novo`
2. Passo 1 — Cliente + template (ou IA)
3. Passo 2 — Preenche valor, prazo, escopo
4. Passo 3 — Adiciona signatarios (voce + cliente)
5. **Criar** — contrato vai pra status "pronto"
6. Na tela do contrato, clica **"Enviar pra assinatura"**
7. Sistema gera PDF + sobe pra Clicksign + envia email pros signatarios
8. Signatarios recebem email, clicam, assinam
9. Webhook Clicksign atualiza status do contrato automaticamente

### Criar cobranca
1. `/cobrancas` > **Nova cobranca**
2. Cliente + descricao + valor + vencimento + forma (PIX/boleto/cartao)
3. **Criar** — sistema cria customer no Asaas (se ainda nao existe) + payment
4. Retorna com link da fatura + QR code PIX + boleto URL
5. Clica **WhatsApp** na listagem pra enviar tudo pro cliente
6. Quando cliente paga, webhook Asaas atualiza status pra "paga"
7. Dashboard `/financeiro` mostra receita atualizada

### Dashboard Financeiro
- MRR (soma assinaturas ativas, proporcional ao ciclo)
- ARR (MRR x 12)
- Receita recebida ultimos 30d
- Previsao proximos 30d (cobrancas pendentes que vencem)
- Inadimplencia (cobrancas vencidas nao pagas)
- Top clientes por MRR
- Lista de inadimplentes com total em aberto

---

## O que ainda falta (Fatia N.2 futuro)
- UI pra criar/editar templates customizados
- UI pra criar assinatura recorrente direto (hoje e so via API)
- Billing portal pro cliente ver historico
- Notas fiscais automaticas (integracao NFe.io ou MigrateCloud)
- Geracao de PDF do contrato final assinado (download via Clicksign API)
- Auto-criar cobranca quando contrato e assinado (trigger)
