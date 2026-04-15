-- ============================================================
-- MIGRATION 013: Prospeccao Ativa (B2B outbound)
-- ============================================================

create table if not exists prospeccao_listas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  segmento text,                        -- "oficinas mecanicas", "clinicas odontologicas"
  cidade text,
  estado text,
  raio_km int default 20,
  qtd_alvo int default 50,
  status text default 'ativa',          -- ativa, pausada, concluida
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_prospeccao_listas_tenant on prospeccao_listas(tenant_id);

do $$ begin
  create type prospeccao_status as enum (
    'novo','contato_feito','agendado','reuniao_realizada','ganho','perdido','sem_interesse'
  );
exception when duplicate_object then null; end $$;

create table if not exists prospeccao_leads (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lista_id uuid references prospeccao_listas(id) on delete cascade,
  assigned_to uuid references profiles(id),

  -- dados empresa
  nome text not null,
  endereco text,
  cidade text,
  estado text,
  telefone text,
  whatsapp text,
  email text,
  website text,
  has_website boolean generated always as (website is not null and website <> '') stored,
  segmento text,
  categoria text,
  rating numeric(2,1),
  reviews_count int,

  -- google places
  google_place_id text unique,
  google_maps_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),

  -- status operacional
  status prospeccao_status default 'novo',
  prioridade text default 'normal',     -- baixa, normal, alta, quente
  notas text,
  proximo_contato_at timestamptz,

  position int default 0,               -- ordenacao no kanban

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prospeccao_leads_lista on prospeccao_leads(lista_id, status);
create index if not exists idx_prospeccao_leads_assigned on prospeccao_leads(assigned_to) where assigned_to is not null;
create index if not exists idx_prospeccao_leads_tenant_status on prospeccao_leads(tenant_id, status);

do $$ begin
  create type atividade_tipo as enum (
    'ligacao','whatsapp','email','reuniao','visita','nota'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type atividade_resultado as enum (
    'atendeu','nao_atendeu','caixa_postal','agendou','nao_tem_interesse','pediu_retorno','conseguiu_email','enviou_proposta'
  );
exception when duplicate_object then null; end $$;

create table if not exists prospeccao_atividades (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references prospeccao_leads(id) on delete cascade,
  user_id uuid references profiles(id),

  tipo atividade_tipo not null,
  resultado atividade_resultado,
  duracao_seg int,                      -- duracao da ligacao
  notas text,
  proximo_passo text,
  proximo_contato_at timestamptz,

  created_at timestamptz default now()
);
create index if not exists idx_prospeccao_atv_lead on prospeccao_atividades(lead_id, created_at desc);
create index if not exists idx_prospeccao_atv_user_date on prospeccao_atividades(user_id, created_at);

create table if not exists prospeccao_agendamentos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references prospeccao_leads(id) on delete cascade,
  user_id uuid references profiles(id),

  titulo text not null,
  data_reuniao timestamptz not null,
  duracao_min int default 30,
  link_reuniao text,                    -- Google Meet, Zoom, presencial
  google_calendar_event_id text,

  status text default 'agendado',       -- agendado, realizada, cancelada, no_show
  notas text,

  created_at timestamptz default now()
);
create index if not exists idx_prospeccao_agd_data on prospeccao_agendamentos(data_reuniao);
create index if not exists idx_prospeccao_agd_user on prospeccao_agendamentos(user_id, data_reuniao);

alter table prospeccao_listas enable row level security;
alter table prospeccao_leads enable row level security;
alter table prospeccao_atividades enable row level security;
alter table prospeccao_agendamentos enable row level security;

do $$ begin
  create policy "prospeccao_listas_all" on prospeccao_listas for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "prospeccao_leads_all" on prospeccao_leads for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "prospeccao_atv_all" on prospeccao_atividades for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "prospeccao_agd_all" on prospeccao_agendamentos for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
