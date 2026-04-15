-- ============================================================
-- Migration 011 - White label + Onboarding
-- ============================================================

-- Portais cliente: cada cliente automotivo pode ter portal proprio
create table if not exists cliente_portais (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null unique references clientes(id) on delete cascade,
  subdomain text unique,                      -- ex: "athos" pra athos.gruponogueiramkt.com
  custom_domain text,                          -- ex: app.athosmotors.com
  logo_url text,
  primary_color text default '#0055cc',
  nome_portal text,
  welcome_message text,
  show_financeiro boolean default false,
  show_integracoes boolean default false,
  is_active boolean default true,
  access_password_hash text,                   -- se quiser proteger com senha
  created_at timestamptz default now()
);

-- Usuarios do portal cliente (vendedores da loja, cliente final)
create table if not exists cliente_portal_users (
  id uuid primary key default uuid_generate_v4(),
  portal_id uuid not null references cliente_portais(id) on delete cascade,
  user_id uuid references profiles(id),
  email text not null,
  nome text,
  role text default 'viewer',                  -- viewer, editor, admin_cliente
  is_active boolean default true,
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  unique (portal_id, email)
);

-- Convites pendentes
create table if not exists team_invites (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  role team_role default 'readonly',
  team text,
  token text unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now(),
  unique (tenant_id, email)
);

-- Onboarding progress (mostra wizard ao usuario)
create table if not exists onboarding_progress (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  step_create_agency boolean default true,      -- completado no signup
  step_import_clients boolean default false,
  step_connect_meta boolean default false,
  step_create_agent_ia boolean default false,
  step_create_first_charge boolean default false,
  step_invite_team boolean default false,
  step_configure_webhooks boolean default false,
  completed boolean default false,
  completed_at timestamptz,
  updated_at timestamptz default now()
);

alter table cliente_portais enable row level security;
alter table cliente_portal_users enable row level security;
alter table team_invites enable row level security;
alter table onboarding_progress enable row level security;

drop policy if exists "cp_all" on cliente_portais;
create policy "cp_all" on cliente_portais for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "cpu_all" on cliente_portal_users;
create policy "cpu_all" on cliente_portal_users for all
  using (exists(select 1 from cliente_portais p where p.id = portal_id and user_has_tenant(p.tenant_id)))
  with check (exists(select 1 from cliente_portais p where p.id = portal_id and user_has_tenant(p.tenant_id)));

drop policy if exists "ti_all" on team_invites;
create policy "ti_all" on team_invites for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "ob_read" on onboarding_progress;
create policy "ob_read" on onboarding_progress for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- trigger pra criar onboarding_progress quando tenant e criado
create or replace function create_onboarding_progress() returns trigger as $$
begin
  insert into onboarding_progress (tenant_id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_onboarding_create after insert on tenants
    for each row execute function create_onboarding_progress();
exception when duplicate_object then null; end $$;

-- popula pros tenants existentes
insert into onboarding_progress (tenant_id) select id from tenants on conflict do nothing;
