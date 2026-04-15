-- ============================================================
-- MIGRATION 015: Modulo YouTube (Minerador + agentes)
-- ============================================================

create table if not exists youtube_pesquisas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  categoria text not null,
  pais text default 'BR',
  max_inscritos int default 100000,
  min_inscritos int default 1000,
  max_videos int default 50,
  idioma text default 'pt',
  total_encontrados int default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_youtube_pesquisas_tenant on youtube_pesquisas(tenant_id);

create table if not exists youtube_canais_minerados (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pesquisa_id uuid references youtube_pesquisas(id) on delete cascade,

  channel_id text not null,
  channel_name text not null,
  channel_url text,
  inscritos int,
  total_videos int,
  total_views bigint,
  data_criacao_canal date,
  idioma text,
  pais text,
  thumbnail_url text,
  descricao text,

  media_views_ultimos_30d bigint,
  ctr_estimado numeric(5,2),                   -- views / inscritos
  score_oportunidade int,                      -- 0-100 calculado

  -- trends comparativo
  trends_google_score int,                     -- 0-100
  trends_youtube_score int,                    -- 0-100
  trends_gap int,                              -- google - youtube (maior = oportunidade)

  created_at timestamptz default now(),
  unique (tenant_id, channel_id)
);
create index if not exists idx_youtube_canais_pesquisa on youtube_canais_minerados(pesquisa_id);
create index if not exists idx_youtube_canais_score on youtube_canais_minerados(score_oportunidade desc);

create table if not exists youtube_roteiros (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,

  titulo text not null,
  descricao text,
  tags text,                                   -- 500 chars de tags
  roteiro text,                                -- markdown completo
  duracao_min int default 10,
  links jsonb default '[]'::jsonb,             -- [{nome, url}]

  gerado_por text,                             -- titulo_magnetico, descricao, roteiro
  metadata jsonb default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_youtube_roteiros_tenant on youtube_roteiros(tenant_id, created_at desc);

alter table youtube_pesquisas enable row level security;
alter table youtube_canais_minerados enable row level security;
alter table youtube_roteiros enable row level security;

do $$ begin
  create policy "yt_pesq_all" on youtube_pesquisas for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "yt_canais_all" on youtube_canais_minerados for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "yt_rot_all" on youtube_roteiros for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
