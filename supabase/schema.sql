-- ============================================================
-- Grupo Nogueira OS - Schema Inicial
-- Multi-tenant white-label
-- ============================================================

-- extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TENANTS (a agencia em si, e os clientes revendedores white-label)
-- ============================================================
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  domain text,
  logo_url text,
  primary_color text default '#0055cc',
  plan text default 'starter', -- starter, pro, enterprise
  is_master boolean default false, -- true para o Grupo Nogueira (dono do sistema)
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- USERS + MEMBERSHIP
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz default now()
);

create type team_role as enum ('owner','admin','trafego','comercial','social','video','support','readonly');

create table if not exists memberships (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role team_role not null default 'readonly',
  team text, -- 'trafego','comercial','social','video','admin'
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (tenant_id, user_id)
);

-- ============================================================
-- CLIENTES
-- ============================================================
create type cliente_status as enum ('ativo','pausado','encerrado','prospect');

create table if not exists clientes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  slug text not null,
  nome text not null,
  contato_nome text,
  contato_email text,
  contato_whatsapp text,
  segmento text,
  status cliente_status default 'ativo',
  ticket_mensal numeric(12,2) default 0,
  vencimento int, -- dia do mes (1-31). multiplos vencimentos em vencimentos_extra
  vencimentos_extra int[] default '{}',
  data_inicio date,
  data_encerramento date,
  responsavel_user_id uuid references profiles(id),
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_clientes_tenant on clientes(tenant_id);
create index if not exists idx_clientes_status on clientes(tenant_id, status);

-- ============================================================
-- INTEGRACOES POR CLIENTE (Meta, Google, Z-API etc)
-- ============================================================
create type integration_provider as enum (
  'meta_ads','google_ads','ga4','gtm','google_calendar','gmail',
  'messenger','instagram','whatsapp_cloud','zapi','tiktok_ads','linkedin_ads'
);

create table if not exists integrations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  provider integration_provider not null,
  account_id text, -- ex: act_411266327455499 ou customer_id
  account_name text,
  access_token text, -- criptografado idealmente
  refresh_token text,
  extra jsonb default '{}'::jsonb,
  is_connected boolean default false,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_integrations_tenant on integrations(tenant_id);
create index if not exists idx_integrations_cliente on integrations(cliente_id);

-- ============================================================
-- METRICAS CACHE (snapshot diario pra dashboards rapidos)
-- ============================================================
create table if not exists campanhas_cache (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  provider integration_provider not null,
  campaign_id text not null,
  campaign_name text,
  status text,
  objetivo text,
  raw jsonb,
  updated_at timestamptz default now(),
  unique (cliente_id, provider, campaign_id)
);

create table if not exists metrics_daily (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  provider integration_provider not null,
  date date not null,
  campaign_id text,
  impressions bigint default 0,
  clicks bigint default 0,
  spend numeric(12,2) default 0,
  leads int default 0,
  conversions int default 0,
  revenue numeric(12,2) default 0,
  extra jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (cliente_id, provider, date, campaign_id)
);

create index if not exists idx_metrics_cliente_date on metrics_daily(cliente_id, date desc);

-- ============================================================
-- KANBAN (boards por time ou por cliente)
-- ============================================================
create table if not exists boards (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  scope text default 'geral', -- 'geral','cliente','time'
  cliente_id uuid references clientes(id) on delete cascade,
  team text, -- trafego, comercial, social, video
  created_at timestamptz default now()
);

create table if not exists board_columns (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  color text default '#64748b',
  position int not null default 0,
  wip_limit int
);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid not null references boards(id) on delete cascade,
  column_id uuid references board_columns(id) on delete set null,
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  title text not null,
  description text,
  assignee_id uuid references profiles(id),
  priority text default 'normal', -- low, normal, high, urgent
  due_date date,
  position int default 0,
  tags text[] default '{}',
  checklist jsonb default '[]'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tasks_board on tasks(board_id, column_id, position);
create index if not exists idx_tasks_assignee on tasks(assignee_id);

-- ============================================================
-- FOLLOW-UP (email + whatsapp)
-- ============================================================
create type followup_channel as enum ('email','whatsapp','sms');
create type followup_status as enum ('draft','scheduled','sent','failed','canceled');

create table if not exists followup_templates (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  channel followup_channel not null,
  subject text,
  body text not null,
  variables jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists followup_flows (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  trigger text, -- 'cliente_novo','vencimento','lead_novo','manual'
  steps jsonb default '[]'::jsonb, -- [{template_id, delay_hours, channel}]
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists followup_runs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  flow_id uuid references followup_flows(id) on delete set null,
  template_id uuid references followup_templates(id) on delete set null,
  channel followup_channel not null,
  recipient text not null,
  subject text,
  body text not null,
  status followup_status default 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);

create index if not exists idx_followup_status on followup_runs(status, scheduled_for);

-- ============================================================
-- MENSAGENS UNIFICADAS (Messenger/IG/WhatsApp)
-- ============================================================
create type message_direction as enum ('in','out');
create type message_platform as enum ('messenger','instagram','whatsapp','email');

create table if not exists conversas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  platform message_platform not null,
  external_id text not null, -- id da conversa na plataforma
  contact_name text,
  contact_identifier text, -- numero/PSID/IG ID
  last_message_at timestamptz,
  unread_count int default 0,
  ai_enabled boolean default false,
  assigned_user_id uuid references profiles(id),
  tags text[] default '{}',
  created_at timestamptz default now(),
  unique (platform, external_id)
);

create table if not exists mensagens (
  id uuid primary key default uuid_generate_v4(),
  conversa_id uuid not null references conversas(id) on delete cascade,
  direction message_direction not null,
  author text, -- 'cliente'|'agente'|'ia'
  content text,
  attachments jsonb default '[]'::jsonb,
  external_id text,
  sent_at timestamptz default now()
);

create index if not exists idx_mensagens_conversa on mensagens(conversa_id, sent_at desc);

-- ============================================================
-- IA AGENTS (atendimento automatizado)
-- ============================================================
create table if not exists ai_agents (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade, -- null = agente interno
  name text not null,
  persona text not null,
  system_prompt text not null,
  knowledge_base jsonb default '[]'::jsonb,
  model text default 'claude-sonnet-4-6',
  temperature numeric(3,2) default 0.7,
  channels text[] default '{}', -- ['messenger','whatsapp','instagram']
  fallback_human boolean default true,
  is_active boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- CALENDAR + EMAIL SYNC
-- ============================================================
create table if not exists calendar_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references profiles(id),
  cliente_id uuid references clientes(id) on delete set null,
  google_event_id text,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  attendees jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null,
  resource text,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
create or replace function current_tenant_id() returns uuid as $$
  select tenant_id from memberships where user_id = auth.uid() and is_active = true limit 1;
$$ language sql stable security definer;

create or replace function user_has_tenant(target_tenant uuid) returns boolean as $$
  select exists(
    select 1 from memberships
    where user_id = auth.uid() and tenant_id = target_tenant and is_active = true
  );
$$ language sql stable security definer;

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$ begin
  create trigger trg_clientes_updated before update on clientes
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_tenants_updated before update on tenants
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_tasks_updated before update on tasks
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_integrations_updated before update on integrations
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
