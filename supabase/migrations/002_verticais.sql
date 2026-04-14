-- ============================================================
-- Migration 002 - Sistema multi-vertical (Agencia / Comercial / Automotivo)
-- + CRM de leads + Pipelines customizaveis + Automacoes + Estoque automotivo
-- ============================================================

-- VERTICAL do tenant (define quais modulos acendem)
do $$ begin
  create type tenant_vertical as enum ('agencia','comercial','automotivo','generico');
exception when duplicate_object then null; end $$;

alter table tenants add column if not exists vertical tenant_vertical default 'agencia';
alter table tenants add column if not exists modules jsonb default '{}'::jsonb;
-- modules ex: {"crm":true,"automotivo":false,"financiamento":false,"email_parser":true}

-- Marca clientes que sao "automotivo" mesmo se o tenant geral nao for
alter table clientes add column if not exists vertical tenant_vertical default 'agencia';
alter table clientes add column if not exists modules jsonb default '{}'::jsonb;
alter table clientes add column if not exists email_inbound text;
-- ex: loja-athos-motors@leads.gruponogueiramkt.com
alter table clientes add column if not exists webhook_token text default encode(gen_random_bytes(16),'hex');
create unique index if not exists uq_cliente_webhook_token on clientes(webhook_token);
create unique index if not exists uq_cliente_email_inbound on clientes(email_inbound) where email_inbound is not null;

-- ============================================================
-- VENDEDORES (subset de profiles que atendem leads)
-- ============================================================
create table if not exists vendedores (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  user_id uuid references profiles(id), -- pode ser null se vendedor nao tem login
  nome text not null,
  email text,
  whatsapp text,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_vendedores_cliente on vendedores(cliente_id);

-- ============================================================
-- PIPELINES (kanban customizavel por cliente/vertical)
-- ============================================================
create table if not exists pipelines (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  name text not null,
  vertical tenant_vertical default 'generico',
  is_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists pipeline_stages (
  id uuid primary key default uuid_generate_v4(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  color text default '#64748b',
  position int not null default 0,
  is_won boolean default false,    -- estagio "ganho" (fim do funil)
  is_lost boolean default false,   -- estagio "perdido"
  sla_minutes int,                  -- se passar disso, trigger de timeout
  next_stage_id uuid references pipeline_stages(id) on delete set null,
  metadata jsonb default '{}'::jsonb
);
create index if not exists idx_stages_pipeline on pipeline_stages(pipeline_id, position);

-- ============================================================
-- LEADS (substitui/complementa "tasks" para vertical comercial/automotivo)
-- ============================================================
do $$ begin
  create type lead_status as enum ('novo','em_atendimento','qualificado','proposta','negociacao','ganho','perdido','arquivado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_origem as enum (
    'meta_ads_facebook','meta_ads_instagram','meta_ads_messenger','meta_ads_whatsapp',
    'google_ads_search','google_ads_youtube','google_ads_display','google_ads_shopping',
    'webmotors','olx','mercadolivre','revenda_mais','mobiauto','icarros','autoadm',
    'nuvem_auto','loja_conectada','estoque_integrado','integracarros','motorleads',
    'autocerto','autoconf','organico','direto','indicacao','outro'
  );
exception when duplicate_object then null; end $$;

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  pipeline_id uuid references pipelines(id),
  stage_id uuid references pipeline_stages(id),

  nome text,
  email text,
  telefone text,
  whatsapp text,
  cpf text,
  cidade text,
  estado text,

  origem lead_origem default 'outro',
  origem_detalhe text, -- ex: nome da campanha, plataforma extra
  source_url text,
  utm jsonb default '{}'::jsonb,
  fbclid text,
  gclid text,

  -- automotivo (NULL pra outros verticais)
  veiculo_interesse_id uuid, -- referencia para veiculos
  modelo_interesse text,
  marca_interesse text,
  ano_interesse int,
  preco_max numeric(12,2),
  forma_pagamento text, -- 'a_vista','financiamento','consorcio','troca'
  veiculo_troca jsonb,  -- {marca, modelo, ano, km, valor_pretendido}

  -- atribuicao
  vendedor_id uuid references vendedores(id) on delete set null,
  vendedor_atribuido_at timestamptz,

  status lead_status default 'novo',
  score int default 0,
  tags text[] default '{}',
  observacoes text,
  valor_estimado numeric(12,2),
  data_fechamento date,

  -- timing
  primeira_resposta_at timestamptz,
  ultima_atividade_at timestamptz default now(),
  perdeu_motivo text,

  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_leads_cliente_status on leads(cliente_id, status);
create index if not exists idx_leads_vendedor on leads(vendedor_id);
create index if not exists idx_leads_stage on leads(stage_id);
create index if not exists idx_leads_origem on leads(cliente_id, origem);

-- atividades do lead (timeline)
do $$ begin
  create type lead_activity_type as enum (
    'created','stage_changed','assigned','message_in','message_out','call','note',
    'email_sent','email_received','followup_scheduled','followup_sent','automation_run'
  );
exception when duplicate_object then null; end $$;

create table if not exists lead_activities (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  type lead_activity_type not null,
  user_id uuid references profiles(id),
  vendedor_id uuid references vendedores(id),
  content text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_activities_lead on lead_activities(lead_id, created_at desc);

-- ============================================================
-- ESTOQUE AUTOMOTIVO
-- ============================================================
create table if not exists veiculos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  external_id text, -- id da DMS/portal de origem
  marca text not null,
  modelo text not null,
  versao text,
  ano int,
  ano_modelo int,
  km int,
  cor text,
  combustivel text,
  cambio text,
  placa text,
  chassi text,
  preco numeric(12,2),
  preco_promocional numeric(12,2),
  fotos jsonb default '[]'::jsonb,    -- [{url, ordem}]
  videos jsonb default '[]'::jsonb,
  opcionais text[] default '{}',
  descricao text,
  status text default 'disponivel',   -- disponivel, reservado, vendido, removido
  origem_anuncio text[] default '{}', -- ['webmotors','icarros','olx']
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_veiculos_cliente on veiculos(cliente_id, status);
create index if not exists idx_veiculos_modelo on veiculos(cliente_id, marca, modelo);

-- referencia FK em leads agora que veiculos existe
alter table leads add constraint fk_leads_veiculo foreign key (veiculo_interesse_id) references veiculos(id) on delete set null;

-- ============================================================
-- AUTOMACOES (gatilho -> condicao -> acao)
-- ============================================================
do $$ begin
  create type automation_trigger_type as enum (
    'lead_created','lead_stage_changed','lead_assigned','lead_idle',
    'message_received','message_sent','sla_breach','time_after_creation',
    'no_response_from_seller','tag_added','field_changed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_action_type as enum (
    'move_stage','assign_seller','assign_round_robin','send_message_whatsapp',
    'send_message_messenger','send_email','create_task','add_tag','remove_tag',
    'notify_user','escalate_to_manager','create_calendar_event','run_ai_response',
    'send_vehicle_photo','simulate_financing','set_field','webhook'
  );
exception when duplicate_object then null; end $$;

create table if not exists automations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  pipeline_id uuid references pipelines(id) on delete cascade,
  name text not null,
  trigger automation_trigger_type not null,
  trigger_config jsonb default '{}'::jsonb,
  -- ex: {"stage_id":"...","minutes":30} ou {"vertical":"automotivo"}
  conditions jsonb default '[]'::jsonb,
  -- [{"field":"origem","op":"=","value":"webmotors"}]
  actions jsonb default '[]'::jsonb,
  -- [{"type":"send_message_whatsapp","template":"oi {{nome}}..."},{"type":"move_stage","stage_id":"..."}]
  is_active boolean default true,
  run_count int default 0,
  last_run_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_automations_active on automations(tenant_id, is_active);

create table if not exists automation_runs (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references automations(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  status text default 'success',
  output jsonb default '{}'::jsonb,
  error text,
  created_at timestamptz default now()
);

-- ============================================================
-- TEMPLATES de mensagem (reaproveita followup_templates mas adiciona alguns)
-- ============================================================
alter table followup_templates add column if not exists vertical tenant_vertical default 'generico';
alter table followup_templates add column if not exists category text;
-- 'boas_vindas','timeout_vendedor','qualificacao','proposta','agendamento','pos_venda'

-- ============================================================
-- FINANCIAMENTO (simulacoes / propostas)
-- ============================================================
create table if not exists financiamentos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  veiculo_id uuid references veiculos(id) on delete set null,
  provider text default 'creditas',  -- creditas, banco_pan, itau, etc
  valor_veiculo numeric(12,2),
  entrada numeric(12,2),
  parcelas int,
  taxa_mensal numeric(6,4),
  valor_parcela numeric(12,2),
  cet_anual numeric(6,4),
  status text default 'simulacao', -- simulacao, enviado, pre_aprovado, aprovado, recusado
  payload_request jsonb,
  payload_response jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- INTEGRACAO PORTAIS AUTOMOTIVOS (mapping de credenciais por cliente)
-- ============================================================
do $$ begin
  create type portal_auto as enum (
    'webmotors','olx','mercadolivre','mobiauto','icarros','revenda_mais',
    'autoadm','nuvem_auto','loja_conectada','estoque_integrado','integracarros',
    'motorleads','autocerto','autoconf'
  );
exception when duplicate_object then null; end $$;

create table if not exists portais_integracoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  portal portal_auto not null,
  -- forma de captura: webhook (portal posta no nosso endpoint), email (parser), api (puxamos)
  modo text default 'email', -- 'webhook','email','api'
  webhook_secret text default encode(gen_random_bytes(16),'hex'),
  api_credentials jsonb default '{}'::jsonb,
  email_pattern text, -- regex pra identificar este portal nos emails recebidos
  is_active boolean default true,
  last_lead_at timestamptz,
  total_leads int default 0,
  created_at timestamptz default now(),
  unique (cliente_id, portal)
);

-- ============================================================
-- TRIGGERS (touch updated_at)
-- ============================================================
do $$ begin
  create trigger trg_leads_updated before update on leads
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_veiculos_updated before update on veiculos
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

-- log de stage_changed automatico
create or replace function log_lead_stage_change() returns trigger as $$
begin
  if old.stage_id is distinct from new.stage_id then
    insert into lead_activities (lead_id, type, content, metadata)
    values (new.id, 'stage_changed', 'Movido de estagio',
      jsonb_build_object('from', old.stage_id, 'to', new.stage_id));
  end if;
  if old.vendedor_id is distinct from new.vendedor_id then
    insert into lead_activities (lead_id, type, vendedor_id, content)
    values (new.id, 'assigned', new.vendedor_id, 'Vendedor atribuido');
  end if;
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_log_lead_changes after update on leads
    for each row execute function log_lead_stage_change();
exception when duplicate_object then null; end $$;

-- ============================================================
-- RLS (multi-tenant)
-- ============================================================
alter table vendedores enable row level security;
alter table pipelines enable row level security;
alter table pipeline_stages enable row level security;
alter table leads enable row level security;
alter table lead_activities enable row level security;
alter table veiculos enable row level security;
alter table automations enable row level security;
alter table automation_runs enable row level security;
alter table financiamentos enable row level security;
alter table portais_integracoes enable row level security;

drop policy if exists "vendedores_all" on vendedores;
create policy "vendedores_all" on vendedores for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "pipelines_all" on pipelines;
create policy "pipelines_all" on pipelines for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "pipeline_stages_all" on pipeline_stages;
create policy "pipeline_stages_all" on pipeline_stages for all
  using (exists(select 1 from pipelines p where p.id = pipeline_id and user_has_tenant(p.tenant_id)))
  with check (exists(select 1 from pipelines p where p.id = pipeline_id and user_has_tenant(p.tenant_id)));

drop policy if exists "leads_all" on leads;
create policy "leads_all" on leads for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "lead_activities_all" on lead_activities;
create policy "lead_activities_all" on lead_activities for all
  using (exists(select 1 from leads l where l.id = lead_id and user_has_tenant(l.tenant_id)))
  with check (exists(select 1 from leads l where l.id = lead_id and user_has_tenant(l.tenant_id)));

drop policy if exists "veiculos_all" on veiculos;
create policy "veiculos_all" on veiculos for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "automations_all" on automations;
create policy "automations_all" on automations for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "automation_runs_read" on automation_runs;
create policy "automation_runs_read" on automation_runs for select
  using (exists(select 1 from automations a where a.id = automation_id and user_has_tenant(a.tenant_id)));

drop policy if exists "financiamentos_all" on financiamentos;
create policy "financiamentos_all" on financiamentos for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "portais_all" on portais_integracoes;
create policy "portais_all" on portais_integracoes for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));
