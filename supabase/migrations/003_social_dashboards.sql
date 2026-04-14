-- ============================================================
-- Migration 003 - Social Media + Catalogo de Agentes IA + Alertas
-- + Metricas consolidadas + Diagnostico inteligente
-- ============================================================

-- ============================================================
-- AGENTES IA - catalogo e instancias por cliente
-- ============================================================
do $$ begin
  create type agent_category as enum (
    'social_estrategia','social_pesquisa','social_roteiro','social_legenda','social_carrossel',
    'social_design','social_nicho','social_atendimento','social_metricas','social_reaproveitamento',
    'social_stories','social_persona',
    'trafego_diagnostico','trafego_planejamento','trafego_publico','trafego_keywords',
    'trafego_copy','trafego_criativo','trafego_estrutura','trafego_landing','trafego_otimizacao',
    'trafego_diagnostico_lead','trafego_escala','trafego_relatorio','trafego_remarketing',
    'trafego_crm','trafego_auditoria',
    'comercial_qualificacao','comercial_followup','comercial_simulacao'
  );
exception when duplicate_object then null; end $$;

-- catalogo global de agentes (templates)
create table if not exists agent_catalog (
  key text primary key,                          -- ex: 'social_estrategia'
  category agent_category not null,
  domain text not null,                          -- 'social','trafego','comercial'
  name text not null,
  description text not null,
  default_system_prompt text not null,
  default_input_schema jsonb default '{}'::jsonb,  -- placeholders esperados
  output_format text default 'text',             -- 'text','json','markdown'
  recommended_model text default 'claude-sonnet-4-6',
  recommended_temperature numeric(3,2) default 0.7,
  icon text default 'sparkles',
  position int default 0,
  is_pro boolean default false,
  created_at timestamptz default now()
);

-- instancia de agente por cliente (override do catalogo)
alter table ai_agents add column if not exists agent_key text references agent_catalog(key);
alter table ai_agents add column if not exists category agent_category;
alter table ai_agents add column if not exists input_schema jsonb default '{}'::jsonb;
alter table ai_agents add column if not exists usage_count int default 0;
alter table ai_agents add column if not exists last_used_at timestamptz;

-- execucoes de agentes (historico de outputs gerados)
create table if not exists agent_runs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  agent_id uuid references ai_agents(id) on delete set null,
  agent_key text references agent_catalog(key),
  user_id uuid references profiles(id),
  input jsonb default '{}'::jsonb,
  output text,
  output_data jsonb default '{}'::jsonb,
  tokens_used int default 0,
  duration_ms int,
  status text default 'success',                -- success, error
  error text,
  created_at timestamptz default now()
);
create index if not exists idx_agent_runs_cliente on agent_runs(cliente_id, created_at desc);
create index if not exists idx_agent_runs_agent on agent_runs(agent_key, created_at desc);

-- ============================================================
-- SOCIAL MEDIA - posts, calendario, metricas
-- ============================================================
do $$ begin
  create type post_format as enum ('feed','reel','carrossel','story','video','foto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_status as enum ('ideia','rascunho','aguardando_aprovacao','aprovado','agendado','publicado','rejeitado','arquivado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_pillar as enum ('autoridade','venda','prova_social','bastidor','educacional','entretenimento','engajamento','branding');
exception when duplicate_object then null; end $$;

do $$ begin
  create type social_platform as enum ('instagram','facebook','tiktok','linkedin','youtube','threads');
exception when duplicate_object then null; end $$;

create table if not exists social_posts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  platform social_platform default 'instagram',
  format post_format default 'feed',
  pillar post_pillar default 'autoridade',
  status post_status default 'ideia',
  funnel_stage text default 'topo',             -- topo, meio, fundo
  title text,
  briefing text,                                 -- ideia inicial
  copy text,                                     -- legenda final
  hook text,                                     -- gancho do reel/post
  cta text,
  hashtags text[] default '{}',
  carrossel_slides jsonb default '[]'::jsonb,    -- [{titulo, texto, ordem}]
  roteiro text,                                  -- script do reel
  design_brief text,                             -- briefing pro designer
  midia_urls jsonb default '[]'::jsonb,          -- [{url, type, position}]
  external_id text,                              -- id no IG/FB/etc apos publicar
  external_url text,
  scheduled_for timestamptz,
  published_at timestamptz,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  feedback text,                                 -- ajustes pedidos pelo cliente
  generated_by_agent text,                       -- agent_key se foi IA
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_posts_cliente on social_posts(cliente_id, status);
create index if not exists idx_posts_scheduled on social_posts(scheduled_for) where status in ('agendado','aprovado');

-- metricas dos posts publicados
create table if not exists social_post_metrics (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references social_posts(id) on delete cascade,
  collected_at timestamptz default now(),
  alcance bigint default 0,
  impressoes bigint default 0,
  curtidas bigint default 0,
  comentarios bigint default 0,
  compartilhamentos bigint default 0,
  salvamentos bigint default 0,
  visualizacoes bigint default 0,
  cliques_link bigint default 0,
  reach_organico bigint default 0,
  reach_pago bigint default 0,
  retencao_video numeric(5,2),                  -- % de retencao do video
  taxa_engajamento numeric(5,2),
  raw jsonb default '{}'::jsonb
);
create index if not exists idx_post_metrics on social_post_metrics(post_id, collected_at desc);

-- snapshot diario do perfil (seguidores, alcance da semana, etc)
create table if not exists social_profile_snapshots (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  platform social_platform default 'instagram',
  date date not null,
  followers int default 0,
  following int default 0,
  posts_count int default 0,
  alcance_periodo bigint default 0,
  impressoes_periodo bigint default 0,
  visitas_perfil bigint default 0,
  cliques_link_bio bigint default 0,
  novos_seguidores int default 0,
  perdidos int default 0,
  raw jsonb default '{}'::jsonb,
  unique (cliente_id, platform, date)
);
create index if not exists idx_profile_snap on social_profile_snapshots(cliente_id, date desc);

-- pilares de conteudo configurados por cliente (resultado do agente de estrategia)
create table if not exists social_content_strategy (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  pilares jsonb default '[]'::jsonb,             -- [{nome, descricao, percentual}]
  persona jsonb default '{}'::jsonb,             -- {nome, idade, dores, desejos, objecoes}
  tom_de_voz text,
  publico_alvo text,
  topo_funil jsonb default '[]'::jsonb,
  meio_funil jsonb default '[]'::jsonb,
  fundo_funil jsonb default '[]'::jsonb,
  generated_by text,                             -- agent_key que gerou
  updated_at timestamptz default now()
);

-- ============================================================
-- ALERTAS INTELIGENTES
-- ============================================================
do $$ begin
  create type alert_severity as enum ('info','warning','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_type as enum (
    'queda_leads','aumento_cpl','ctr_baixo','frequencia_alta','queda_engajamento',
    'sem_postagem','sem_conversao','tempo_resposta_alto','sla_estourado',
    'roas_caiu','vencimento_proximo','desgaste_criativo','lead_esquecido',
    'campanha_pausada','orcamento_estourado','desempenho_excelente'
  );
exception when duplicate_object then null; end $$;

create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  type alert_type not null,
  severity alert_severity default 'warning',
  title text not null,
  message text,
  metric_name text,
  current_value numeric,
  expected_value numeric,
  delta_pct numeric,
  resource_type text,                           -- 'campaign','post','vendedor','lead'
  resource_id text,
  is_read boolean default false,
  is_resolved boolean default false,
  resolved_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_alerts_tenant on alerts(tenant_id, is_resolved, severity, created_at desc);
create index if not exists idx_alerts_cliente on alerts(cliente_id, is_resolved);

-- ============================================================
-- METRICAS CONSOLIDADAS - viewer-friendly
-- ============================================================
-- view materializada com agregados por cliente nos ultimos 30 dias
create or replace view v_metrics_summary as
select
  c.id as cliente_id,
  c.tenant_id,
  c.nome as cliente_nome,
  c.vertical,
  c.status as cliente_status,
  c.ticket_mensal,
  -- meta ads / google ads
  coalesce(sum(case when md.date >= current_date - 30 then md.spend end), 0) as spend_30d,
  coalesce(sum(case when md.date >= current_date - 30 then md.clicks end), 0) as clicks_30d,
  coalesce(sum(case when md.date >= current_date - 30 then md.impressions end), 0) as impressions_30d,
  coalesce(sum(case when md.date >= current_date - 30 then md.leads end), 0) as leads_30d,
  coalesce(sum(case when md.date >= current_date - 30 then md.conversions end), 0) as conversoes_30d,
  -- comparativo periodo anterior
  coalesce(sum(case when md.date between current_date - 60 and current_date - 30 then md.spend end), 0) as spend_30d_anterior,
  coalesce(sum(case when md.date between current_date - 60 and current_date - 30 then md.leads end), 0) as leads_30d_anterior
from clientes c
left join metrics_daily md on md.cliente_id = c.id
group by c.id;

-- function pra calcular tempo medio de resposta de leads
create or replace function tempo_medio_resposta_min(p_cliente_id uuid, p_dias int default 30)
returns numeric as $$
  select coalesce(round(avg(extract(epoch from (primeira_resposta_at - created_at)) / 60)::numeric, 2), 0)
  from leads
  where cliente_id = p_cliente_id
    and primeira_resposta_at is not null
    and created_at >= now() - (p_dias || ' days')::interval;
$$ language sql stable;

-- function pra ranking do cliente
create or replace function cliente_health_score(p_cliente_id uuid)
returns int as $$
declare
  score int := 100;
  alertas_count int;
begin
  select count(*) into alertas_count from alerts
    where cliente_id = p_cliente_id and is_resolved = false and severity in ('warning','critical');
  score := score - (alertas_count * 8);
  return greatest(0, least(100, score));
end;
$$ language plpgsql stable;

-- ============================================================
-- RLS
-- ============================================================
alter table agent_catalog enable row level security;
alter table agent_runs enable row level security;
alter table social_posts enable row level security;
alter table social_post_metrics enable row level security;
alter table social_profile_snapshots enable row level security;
alter table social_content_strategy enable row level security;
alter table alerts enable row level security;

drop policy if exists "catalog_read_all" on agent_catalog;
create policy "catalog_read_all" on agent_catalog for select to authenticated using (true);

drop policy if exists "agent_runs_all" on agent_runs;
create policy "agent_runs_all" on agent_runs for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "social_posts_all" on social_posts;
create policy "social_posts_all" on social_posts for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "social_metrics_read" on social_post_metrics;
create policy "social_metrics_read" on social_post_metrics for select
  using (exists(select 1 from social_posts p where p.id = post_id and user_has_tenant(p.tenant_id)));

drop policy if exists "social_snap_all" on social_profile_snapshots;
create policy "social_snap_all" on social_profile_snapshots for all
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)))
  with check (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));

drop policy if exists "strategy_all" on social_content_strategy;
create policy "strategy_all" on social_content_strategy for all
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)))
  with check (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));

drop policy if exists "alerts_all" on alerts;
create policy "alerts_all" on alerts for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- triggers
do $$ begin
  create trigger trg_posts_updated before update on social_posts
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
