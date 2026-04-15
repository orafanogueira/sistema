-- ============================================================
-- MIGRATION 014: Social multi-plataforma + upload de midia
-- ============================================================

-- extensao de social_posts
alter table social_posts add column if not exists platforms text[] default '{}';
-- lista de plataformas pra publicar: instagram, facebook, linkedin, tiktok, youtube
alter table social_posts add column if not exists copies_by_platform jsonb default '{}'::jsonb;
-- { "instagram": "...", "linkedin": "...", "facebook": "..." }

-- tabela de midia
create table if not exists social_media_assets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  post_id uuid references social_posts(id) on delete cascade,
  url text not null,                       -- Supabase Storage public URL
  storage_path text not null,              -- path no bucket pra delete
  tipo text default 'imagem',              -- imagem, video, gif
  mime_type text,
  size_bytes int,
  width int,
  height int,
  duration_sec numeric(8,2),
  position int default 0,                  -- ordem em carrossel
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_social_assets_post on social_media_assets(post_id, position);
create index if not exists idx_social_assets_cliente on social_media_assets(cliente_id);

alter table social_media_assets enable row level security;

do $$ begin
  create policy "social_assets_all" on social_media_assets for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

-- publicacoes por plataforma (1 post pode virar N publicacoes reais)
create table if not exists social_publicacoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  post_id uuid not null references social_posts(id) on delete cascade,
  platform text not null,                  -- instagram, facebook, linkedin, etc
  copy_usada text,
  scheduled_for timestamptz,
  published_at timestamptz,
  external_id text,
  external_url text,
  status text default 'pendente',          -- pendente, publicando, publicado, erro
  error_message text,
  created_at timestamptz default now()
);
create index if not exists idx_social_pub_post on social_publicacoes(post_id);
create index if not exists idx_social_pub_schedule on social_publicacoes(scheduled_for) where status = 'pendente';

alter table social_publicacoes enable row level security;
do $$ begin
  create policy "social_pub_all" on social_publicacoes for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
