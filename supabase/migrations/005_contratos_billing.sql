-- ============================================================
-- Migration 005 - Contratos (Clicksign) + Billing (Asaas)
-- ============================================================

-- ============================================================
-- CONTRATOS
-- ============================================================
do $$ begin
  create type contrato_status as enum (
    'rascunho','gerando_ia','pronto','enviado_assinatura','assinado','cancelado','rejeitado'
  );
exception when duplicate_object then null; end $$;

create table if not exists contrato_templates (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  vertical text,           -- agencia, automotivo, comercial, generico
  categoria text,          -- prestacao_servico, comodato, parceria, etc
  body_template text not null,
  variables jsonb default '[]'::jsonb,  -- ["contratante_nome","valor","prazo",...]
  created_at timestamptz default now()
);

create table if not exists contratos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  template_id uuid references contrato_templates(id) on delete set null,
  numero text,                      -- numero sequencial customizavel
  titulo text not null,
  body text,                         -- contrato completo renderizado
  status contrato_status default 'rascunho',
  valor numeric(12,2),
  forma_pagamento text,              -- unico, mensal, trimestral, anual
  parcelas int default 1,
  data_inicio date,
  data_fim date,
  observacoes text,
  campos_preenchidos jsonb default '{}'::jsonb,

  -- Clicksign
  clicksign_document_key text,
  clicksign_url text,
  signed_pdf_url text,

  -- timing
  generated_by_agent text,           -- 'comercial_contrato'
  sent_for_signing_at timestamptz,
  signed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_contratos_cliente on contratos(cliente_id, status);
create index if not exists idx_contratos_tenant_status on contratos(tenant_id, status);

create table if not exists contrato_signatarios (
  id uuid primary key default uuid_generate_v4(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  nome text not null,
  email text not null,
  cpf text,
  telefone text,
  role text default 'contratante',   -- contratante, contratada, testemunha
  clicksign_signer_key text,
  signed_at timestamptz,
  signed_ip text,
  created_at timestamptz default now()
);
create index if not exists idx_signatarios on contrato_signatarios(contrato_id);

create table if not exists contrato_eventos (
  id uuid primary key default uuid_generate_v4(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  type text not null,    -- created, generated_ia, sent, viewed, signed, refused
  actor text,            -- user_id ou email
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- BILLING (cobrancas + assinaturas recorrentes)
-- ============================================================
do $$ begin
  create type cobranca_status as enum (
    'pendente','vencida','paga','cancelada','reembolsada','estornada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type cobranca_forma as enum ('pix','boleto','credit_card','debit_card','undefined');
exception when duplicate_object then null; end $$;

create table if not exists cobrancas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete set null,
  assinatura_id uuid,
  descricao text,
  valor numeric(12,2) not null,
  forma_pagamento cobranca_forma default 'undefined',
  status cobranca_status default 'pendente',
  due_date date not null,
  paid_at timestamptz,

  -- Asaas
  asaas_payment_id text,
  asaas_invoice_url text,
  asaas_bank_slip_url text,
  pix_copy_paste text,
  pix_qrcode_image text,

  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_cobrancas_cliente on cobrancas(cliente_id, status);
create index if not exists idx_cobrancas_due on cobrancas(due_date) where status in ('pendente','vencida');
create index if not exists idx_cobrancas_asaas on cobrancas(asaas_payment_id) where asaas_payment_id is not null;

create table if not exists assinaturas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete set null,
  descricao text,
  valor_mensal numeric(12,2) not null,
  ciclo text default 'MONTHLY',         -- MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
  dia_vencimento int default 10,
  forma_pagamento cobranca_forma default 'pix',
  active boolean default true,
  data_inicio date default current_date,
  data_fim date,
  asaas_subscription_id text,

  -- MRR calculation helpers
  mrr_amount numeric(12,2) generated always as (
    case
      when ciclo = 'MONTHLY' then valor_mensal
      when ciclo = 'QUARTERLY' then valor_mensal / 3
      when ciclo = 'SEMIANNUALLY' then valor_mensal / 6
      when ciclo = 'YEARLY' then valor_mensal / 12
      else valor_mensal
    end
  ) stored,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_assinaturas_cliente on assinaturas(cliente_id, active);

-- ============================================================
-- CREDENCIAIS DE INTEGRACAO (Clicksign + Asaas + Cacto etc)
-- ============================================================
alter table integrations drop constraint if exists integrations_provider_check;

-- Adiciona valores ao enum integration_provider se faltarem
do $$ begin
  alter type integration_provider add value if not exists 'clicksign';
  alter type integration_provider add value if not exists 'asaas';
  alter type integration_provider add value if not exists 'cacto';
  alter type integration_provider add value if not exists 'autentique';
exception when undefined_object then null; end $$;

-- ============================================================
-- VIEW - dashboard financeiro
-- ============================================================
create or replace view v_financeiro_resumo as
select
  t.id as tenant_id,
  -- MRR total de assinaturas ativas
  coalesce((select sum(mrr_amount) from assinaturas a
    where a.tenant_id = t.id and a.active = true), 0) as mrr,
  -- Receita recebida nos ultimos 30d
  coalesce((select sum(valor) from cobrancas c
    where c.tenant_id = t.id and c.status = 'paga'
      and c.paid_at >= current_date - 30), 0) as receita_30d,
  -- Inadimplencia (vencidas nao pagas)
  coalesce((select sum(valor) from cobrancas c
    where c.tenant_id = t.id and c.status in ('pendente','vencida')
      and c.due_date < current_date), 0) as inadimplencia,
  -- Previsao proximos 30d (cobrancas pendentes com vencimento no mes)
  coalesce((select sum(valor) from cobrancas c
    where c.tenant_id = t.id and c.status = 'pendente'
      and c.due_date between current_date and current_date + 30), 0) as previsao_30d
from tenants t;

-- ============================================================
-- RLS
-- ============================================================
alter table contratos enable row level security;
alter table contrato_templates enable row level security;
alter table contrato_signatarios enable row level security;
alter table contrato_eventos enable row level security;
alter table cobrancas enable row level security;
alter table assinaturas enable row level security;

drop policy if exists "contratos_all" on contratos;
create policy "contratos_all" on contratos for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "contratos_tpl_all" on contrato_templates;
create policy "contratos_tpl_all" on contrato_templates for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "contratos_sig_all" on contrato_signatarios;
create policy "contratos_sig_all" on contrato_signatarios for all
  using (exists(select 1 from contratos c where c.id = contrato_id and user_has_tenant(c.tenant_id)))
  with check (exists(select 1 from contratos c where c.id = contrato_id and user_has_tenant(c.tenant_id)));

drop policy if exists "contratos_ev_read" on contrato_eventos;
create policy "contratos_ev_read" on contrato_eventos for select
  using (exists(select 1 from contratos c where c.id = contrato_id and user_has_tenant(c.tenant_id)));

drop policy if exists "cobrancas_all" on cobrancas;
create policy "cobrancas_all" on cobrancas for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "assinaturas_all" on assinaturas;
create policy "assinaturas_all" on assinaturas for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- triggers updated
do $$ begin
  create trigger trg_contratos_updated before update on contratos
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_cobrancas_updated before update on cobrancas
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_assinaturas_updated before update on assinaturas
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
