-- ============================================================
-- Migration 006 - Automacoes Instagram (ManyChat-like)
-- Palavras-chave em comentarios -> DM automatica
-- ============================================================

-- ============================================================
-- Instagram Accounts conectadas (Business Account via Meta Graph)
-- ============================================================
create table if not exists instagram_accounts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  ig_user_id text not null unique,          -- Instagram Business Account ID
  ig_username text,
  fb_page_id text,                          -- Page ID associada (required pra Messaging)
  page_access_token text,                   -- token da page (long-lived)
  is_active boolean default true,
  webhook_subscribed boolean default false,
  connected_at timestamptz default now(),
  last_sync_at timestamptz
);
create index if not exists idx_ig_accounts_cliente on instagram_accounts(cliente_id, is_active);

-- ============================================================
-- POSTS monitorados (posts/reels/anuncios que a gente escuta)
-- ============================================================
create table if not exists ig_posts_monitorados (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  ig_account_id uuid not null references instagram_accounts(id) on delete cascade,
  ig_media_id text not null,                -- id do post/reel no IG
  ig_media_type text,                        -- IMAGE, VIDEO, CAROUSEL, REEL
  permalink text,
  caption text,
  thumbnail_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (ig_media_id, cliente_id)
);

-- ============================================================
-- AUTOMACOES IG (ManyChat-like)
-- ============================================================
do $$ begin
  create type ig_automacao_trigger as enum (
    'comment_on_post',      -- comentario num post especifico (ou qualquer)
    'dm_received',          -- DM recebida com palavra-chave
    'story_reply',          -- resposta a story
    'story_mention'         -- mencao em story
  );
exception when duplicate_object then null; end $$;

create table if not exists ig_automacoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  ig_account_id uuid not null references instagram_accounts(id) on delete cascade,
  name text not null,
  trigger ig_automacao_trigger default 'comment_on_post',
  -- escopo: posts especificos ou qualquer post
  post_ids uuid[] default '{}',             -- ids em ig_posts_monitorados (vazio = todos)

  -- keywords (palavras que acionam)
  keywords text[] default '{}',              -- ex: ["quero","info","curso","link"]
  keyword_match_mode text default 'any',    -- 'any' (qualquer uma), 'all' (todas), 'exact'
  case_sensitive boolean default false,

  -- acao
  response_text text,                        -- texto da DM
  send_public_reply boolean default false,  -- tambem responder no comentario publico
  public_reply_text text,                   -- ex: "Mandei no seu direct! 📩"

  -- filtro: so envia pra seguidores
  only_followers boolean default false,

  -- filtro: so envia 1x por usuario
  one_per_user boolean default true,

  -- IA opcional: quando a pessoa responder, IA assume atendimento
  ai_takes_over boolean default false,
  ai_agent_id uuid,                         -- agente que assume (ai_agents.id)

  -- atribuicao
  create_lead boolean default true,          -- cria lead no CRM quando dispara
  assign_vendedor boolean default false,
  tags text[] default '{}',

  is_active boolean default true,
  runs_count int default 0,
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_ig_auto_cliente on ig_automacoes(cliente_id, is_active);

-- ============================================================
-- EXECUCOES (cada disparo registrado)
-- ============================================================
create table if not exists ig_automacao_runs (
  id uuid primary key default uuid_generate_v4(),
  automacao_id uuid not null references ig_automacoes(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,

  -- dados do evento
  ig_user_id text not null,                 -- quem comentou (PSID)
  ig_username text,
  comment_id text,                          -- id do comentario (se for comment)
  comment_text text,
  post_id text,                             -- id do post comentado
  post_permalink text,

  matched_keyword text,
  action_taken text default 'sent_dm',      -- 'sent_dm', 'sent_public_reply', 'ignored', 'failed'
  response_sent text,
  is_follower boolean,

  status text default 'success',
  error text,
  created_at timestamptz default now()
);
create index if not exists idx_ig_runs on ig_automacao_runs(automacao_id, created_at desc);
create index if not exists idx_ig_runs_user on ig_automacao_runs(ig_user_id);

-- ============================================================
-- COMMENTS RECEBIDOS (raw log pra analise)
-- ============================================================
create table if not exists ig_comments_raw (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  ig_account_id uuid not null references instagram_accounts(id) on delete cascade,
  comment_id text not null unique,
  post_id text,
  user_id text,                             -- IG Scoped ID do autor
  username text,
  text text,
  processed boolean default false,
  received_at timestamptz default now(),
  raw jsonb
);

-- ============================================================
-- ADICIONA campos em leads pra origem IG
-- ============================================================
alter table leads add column if not exists ig_automacao_id uuid references ig_automacoes(id) on delete set null;
alter table leads add column if not exists ig_post_id text;
alter table leads add column if not exists ig_username text;

-- ============================================================
-- RLS
-- ============================================================
alter table instagram_accounts enable row level security;
alter table ig_posts_monitorados enable row level security;
alter table ig_automacoes enable row level security;
alter table ig_automacao_runs enable row level security;
alter table ig_comments_raw enable row level security;

drop policy if exists "ig_accounts_all" on instagram_accounts;
create policy "ig_accounts_all" on instagram_accounts for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "ig_posts_all" on ig_posts_monitorados;
create policy "ig_posts_all" on ig_posts_monitorados for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "ig_auto_all" on ig_automacoes;
create policy "ig_auto_all" on ig_automacoes for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "ig_runs_read" on ig_automacao_runs;
create policy "ig_runs_read" on ig_automacao_runs for select
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));

drop policy if exists "ig_comments_read" on ig_comments_raw;
create policy "ig_comments_read" on ig_comments_raw for select
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));

-- triggers updated
do $$ begin
  create trigger trg_ig_auto_updated before update on ig_automacoes
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
