-- ============================================================
-- Migration 008 - Customer Success + Relatorios automaticos
-- ============================================================

-- Health score por cliente (snapshot diario)
create table if not exists cs_health_snapshots (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  date date not null,
  health_score int not null,          -- 0-100
  churn_risk text,                    -- low, medium, high
  nps_estimated int,                  -- baseado em comportamento
  -- componentes do score
  score_engagement int default 0,     -- posts, interacao
  score_performance int default 0,    -- campanhas rodando bem
  score_payment int default 0,        -- em dia
  score_comunicacao int default 0,    -- resposta rapida
  score_resultado int default 0,      -- vendas/leads
  -- flags
  has_critical_alerts boolean default false,
  is_inadimplente boolean default false,
  meses_ativo int,
  ltv_estimated numeric(12,2),
  created_at timestamptz default now(),
  unique (cliente_id, date)
);
create index if not exists idx_cs_health_cliente on cs_health_snapshots(cliente_id, date desc);

-- CSM Playbooks (acoes proativas)
create table if not exists cs_playbooks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  trigger text not null,              -- score_dropped, no_activity_7d, high_churn_risk, etc
  condition jsonb default '{}'::jsonb,
  actions jsonb default '[]'::jsonb,  -- [{type: 'task', assignee, message}, {type: 'whatsapp', template}]
  is_active boolean default true,
  runs_count int default 0,
  created_at timestamptz default now()
);

-- Relatorios agendados
create table if not exists relatorios_agendados (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  tipo text default 'mensal',         -- mensal, semanal, trimestral
  formato text default 'pdf',         -- pdf, whatsapp_text, email_html
  dia_do_mes int default 1,           -- quando eh mensal
  destinatarios text[] default '{}',
  channels text[] default '{}',       -- ['whatsapp', 'email']
  include_social boolean default true,
  include_trafego boolean default true,
  include_crm boolean default true,
  include_financeiro boolean default false,
  is_active boolean default true,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists relatorios_runs (
  id uuid primary key default uuid_generate_v4(),
  relatorio_id uuid not null references relatorios_agendados(id) on delete cascade,
  cliente_id uuid references clientes(id),
  periodo_label text,
  content_html text,
  content_whatsapp text,
  pdf_url text,
  sent_to text[] default '{}',
  status text default 'success',
  error text,
  created_at timestamptz default now()
);

alter table cs_health_snapshots enable row level security;
alter table cs_playbooks enable row level security;
alter table relatorios_agendados enable row level security;
alter table relatorios_runs enable row level security;

drop policy if exists "cs_health_read" on cs_health_snapshots;
create policy "cs_health_read" on cs_health_snapshots for select using (user_has_tenant(tenant_id));

drop policy if exists "cs_play_all" on cs_playbooks;
create policy "cs_play_all" on cs_playbooks for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "rel_ag_all" on relatorios_agendados;
create policy "rel_ag_all" on relatorios_agendados for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "rel_runs_read" on relatorios_runs;
create policy "rel_runs_read" on relatorios_runs for select
  using (exists(select 1 from relatorios_agendados r where r.id = relatorio_id and user_has_tenant(r.tenant_id)));
