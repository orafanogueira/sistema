-- ============================================================
-- Row Level Security (RLS) - Multi-tenant isolation
-- Regra geral: usuario so ve dados dos tenants em que tem membership ativa.
-- Tenant master (Grupo Nogueira) enxerga tudo.
-- ============================================================

alter table tenants          enable row level security;
alter table profiles         enable row level security;
alter table memberships      enable row level security;
alter table clientes         enable row level security;
alter table integrations     enable row level security;
alter table campanhas_cache  enable row level security;
alter table metrics_daily    enable row level security;
alter table boards           enable row level security;
alter table board_columns    enable row level security;
alter table tasks            enable row level security;
alter table followup_templates enable row level security;
alter table followup_flows   enable row level security;
alter table followup_runs    enable row level security;
alter table conversas        enable row level security;
alter table mensagens        enable row level security;
alter table ai_agents        enable row level security;
alter table calendar_events  enable row level security;
alter table audit_logs       enable row level security;

-- TENANTS: so ve o proprio
drop policy if exists "tenants_select" on tenants;
create policy "tenants_select" on tenants for select
  using (user_has_tenant(id));

-- PROFILES: todos usuarios autenticados leem perfis (para mencionar/atribuir)
drop policy if exists "profiles_select_auth" on profiles;
create policy "profiles_select_auth" on profiles for select to authenticated using (true);

drop policy if exists "profiles_upsert_self" on profiles;
create policy "profiles_upsert_self" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- MEMBERSHIPS: usuario ve suas proprias memberships
drop policy if exists "memberships_select" on memberships;
create policy "memberships_select" on memberships for select
  using (user_id = auth.uid() or user_has_tenant(tenant_id));

-- macro generator: cada tabela tenant-scoped
-- CLIENTES
drop policy if exists "clientes_all" on clientes;
create policy "clientes_all" on clientes for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- INTEGRATIONS
drop policy if exists "integrations_all" on integrations;
create policy "integrations_all" on integrations for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- CAMPANHAS / METRICS (via cliente -> tenant)
drop policy if exists "campanhas_cache_read" on campanhas_cache;
create policy "campanhas_cache_read" on campanhas_cache for select
  using (exists(select 1 from clientes c where c.id = campanhas_cache.cliente_id and user_has_tenant(c.tenant_id)));

drop policy if exists "metrics_daily_read" on metrics_daily;
create policy "metrics_daily_read" on metrics_daily for select
  using (exists(select 1 from clientes c where c.id = metrics_daily.cliente_id and user_has_tenant(c.tenant_id)));

-- KANBAN
drop policy if exists "boards_all" on boards;
create policy "boards_all" on boards for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "board_columns_all" on board_columns;
create policy "board_columns_all" on board_columns for all
  using (exists(select 1 from boards b where b.id = board_id and user_has_tenant(b.tenant_id)))
  with check (exists(select 1 from boards b where b.id = board_id and user_has_tenant(b.tenant_id)));

drop policy if exists "tasks_all" on tasks;
create policy "tasks_all" on tasks for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- FOLLOW-UP
drop policy if exists "ft_all" on followup_templates;
create policy "ft_all" on followup_templates for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "ff_all" on followup_flows;
create policy "ff_all" on followup_flows for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "fr_all" on followup_runs;
create policy "fr_all" on followup_runs for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- CONVERSAS
drop policy if exists "conv_all" on conversas;
create policy "conv_all" on conversas for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "msg_all" on mensagens;
create policy "msg_all" on mensagens for all
  using (exists(select 1 from conversas c where c.id = conversa_id and user_has_tenant(c.tenant_id)))
  with check (exists(select 1 from conversas c where c.id = conversa_id and user_has_tenant(c.tenant_id)));

-- IA
drop policy if exists "ai_all" on ai_agents;
create policy "ai_all" on ai_agents for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- CALENDAR
drop policy if exists "cal_all" on calendar_events;
create policy "cal_all" on calendar_events for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- AUDIT (read-only pro tenant)
drop policy if exists "audit_read" on audit_logs;
create policy "audit_read" on audit_logs for select
  using (user_has_tenant(tenant_id));
