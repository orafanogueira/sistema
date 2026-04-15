-- ============================================================
-- Migration 007 - Copiloto IA + UTM Builder + Dashboard Publico
-- ============================================================

-- ============================================================
-- COPILOTO IA (conversas do assistente que executa acoes)
-- ============================================================
create table if not exists copilot_conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  context jsonb default '{}'::jsonb,   -- cliente_atual, filtros, etc
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_copilot_conv_user on copilot_conversations(user_id, last_message_at desc);

create table if not exists copilot_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references copilot_conversations(id) on delete cascade,
  role text not null,                  -- user, assistant, tool
  content text,
  tool_calls jsonb default '[]'::jsonb,
  tool_results jsonb default '[]'::jsonb,
  tokens_used int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_copilot_msg on copilot_messages(conversation_id, created_at);

-- ============================================================
-- UTM BUILDER - templates de UTMs por cliente
-- ============================================================
create table if not exists utm_presets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  name text not null,             -- ex: "Meta Ads - Campanha Fev"
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  base_url text,                   -- url do site do cliente (opcional)
  created_at timestamptz default now()
);
create index if not exists idx_utm_cliente on utm_presets(cliente_id);

-- ============================================================
-- DASHBOARD PUBLICO (link compartilhavel sem login)
-- ============================================================
create table if not exists dashboard_public_links (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  name text,
  password_hash text,              -- opcional: protege com senha
  expires_at timestamptz,
  views_count int default 0,
  last_viewed_at timestamptz,
  is_active boolean default true,
  -- config do que mostrar
  show_meta_ads boolean default true,
  show_google_ads boolean default true,
  show_leads boolean default true,
  show_financeiro boolean default false,
  show_social boolean default true,
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);
create index if not exists idx_dash_publico_token on dashboard_public_links(token) where is_active = true;

-- ============================================================
-- RLS
-- ============================================================
alter table copilot_conversations enable row level security;
alter table copilot_messages enable row level security;
alter table utm_presets enable row level security;
alter table dashboard_public_links enable row level security;

drop policy if exists "copilot_conv_own" on copilot_conversations;
create policy "copilot_conv_own" on copilot_conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "copilot_msg_own" on copilot_messages;
create policy "copilot_msg_own" on copilot_messages for all
  using (exists(select 1 from copilot_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists(select 1 from copilot_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

drop policy if exists "utm_presets_all" on utm_presets;
create policy "utm_presets_all" on utm_presets for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "dash_publico_all" on dashboard_public_links;
create policy "dash_publico_all" on dashboard_public_links for all
  using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

-- ============================================================
-- SOCIAL MEDIA - expansao de workflow (Fatia B)
-- ============================================================
alter table social_posts add column if not exists review_notes text;
alter table social_posts add column if not exists cliente_aprovou boolean;
alter table social_posts add column if not exists cliente_aprovou_at timestamptz;
alter table social_posts add column if not exists aprovacao_token text default encode(gen_random_bytes(12), 'hex');

-- historico de revisoes
create table if not exists social_post_revisoes (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references social_posts(id) on delete cascade,
  author text,                      -- 'cliente' ou email do membro
  type text not null,               -- comment, request_change, approve, reject
  content text,
  created_at timestamptz default now()
);
create index if not exists idx_social_rev on social_post_revisoes(post_id, created_at desc);

alter table social_post_revisoes enable row level security;
drop policy if exists "social_rev_all" on social_post_revisoes;
create policy "social_rev_all" on social_post_revisoes for all
  using (exists(select 1 from social_posts p where p.id = post_id and user_has_tenant(p.tenant_id)))
  with check (exists(select 1 from social_posts p where p.id = post_id and user_has_tenant(p.tenant_id)));

-- ============================================================
-- SEO - Fatia M (schema basico)
-- ============================================================
create table if not exists seo_projects (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  site_url text not null,
  gmb_place_id text,              -- Google My Business place ID
  gsc_property text,               -- Google Search Console property URL
  ga4_property_id text,
  strategy_silos jsonb default '[]'::jsonb,     -- [{pilar, subtemas:[]}]
  target_keywords text[] default '{}',
  negative_keywords text[] default '{}',
  competitors text[] default '{}',
  tom_de_voz text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_seo_cliente on seo_projects(cliente_id);

create table if not exists seo_keywords (
  id uuid primary key default uuid_generate_v4(),
  seo_project_id uuid not null references seo_projects(id) on delete cascade,
  keyword text not null,
  search_volume int,
  difficulty int,                  -- 0-100
  intent text,                     -- transactional, informational, navigational, commercial
  funnel_stage text,               -- topo, meio, fundo
  current_position int,
  target_position int default 10,
  url_ranking text,
  last_checked_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_seo_kw_project on seo_keywords(seo_project_id);

create table if not exists seo_content_items (
  id uuid primary key default uuid_generate_v4(),
  seo_project_id uuid not null references seo_projects(id) on delete cascade,
  type text not null,              -- blog_post, gmb_post, pillar_page, cluster_page
  title text not null,
  slug text,
  target_keywords text[] default '{}',
  body_html text,
  meta_title text,
  meta_description text,
  status text default 'draft',     -- draft, review, published, archived
  url_published text,
  published_at timestamptz,
  generated_by_ai boolean default false,
  ai_prompt text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_seo_content_project on seo_content_items(seo_project_id, status);

create table if not exists seo_gmb_posts (
  id uuid primary key default uuid_generate_v4(),
  seo_project_id uuid not null references seo_projects(id) on delete cascade,
  type text default 'update',       -- update, event, offer
  title text,
  body text not null,
  cta_type text,                    -- BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP, CALL
  cta_url text,
  media_urls jsonb default '[]'::jsonb,
  status text default 'draft',
  published_at timestamptz,
  gmb_post_id text,
  created_at timestamptz default now()
);

alter table seo_projects enable row level security;
alter table seo_keywords enable row level security;
alter table seo_content_items enable row level security;
alter table seo_gmb_posts enable row level security;

drop policy if exists "seo_proj_all" on seo_projects;
create policy "seo_proj_all" on seo_projects for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "seo_kw_all" on seo_keywords;
create policy "seo_kw_all" on seo_keywords for all
  using (exists(select 1 from seo_projects p where p.id = seo_project_id and user_has_tenant(p.tenant_id)))
  with check (exists(select 1 from seo_projects p where p.id = seo_project_id and user_has_tenant(p.tenant_id)));

drop policy if exists "seo_content_all" on seo_content_items;
create policy "seo_content_all" on seo_content_items for all
  using (exists(select 1 from seo_projects p where p.id = seo_project_id and user_has_tenant(p.tenant_id)))
  with check (exists(select 1 from seo_projects p where p.id = seo_project_id and user_has_tenant(p.tenant_id)));

drop policy if exists "seo_gmb_all" on seo_gmb_posts;
create policy "seo_gmb_all" on seo_gmb_posts for all
  using (exists(select 1 from seo_projects p where p.id = seo_project_id and user_has_tenant(p.tenant_id)))
  with check (exists(select 1 from seo_projects p where p.id = seo_project_id and user_has_tenant(p.tenant_id)));

-- triggers updated
do $$ begin
  create trigger trg_seo_proj_updated before update on seo_projects
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_seo_content_updated before update on seo_content_items
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
