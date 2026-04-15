-- ============================================================
-- MIGRATION 017: YouTube producao de video (voz + imagens + thumbs)
-- ============================================================

create table if not exists youtube_audios (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  projeto_id uuid,                                      -- futuro: linka com projeto de video
  texto text not null,
  voice_id text not null,
  voice_name text,
  url text not null,                                    -- Supabase Storage public url
  storage_path text not null,
  duration_sec numeric(8,2),
  characters_used int,
  url_sem_pausas text,                                  -- apos remove-pauses
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_yt_audios_tenant on youtube_audios(tenant_id, created_at desc);

create table if not exists youtube_video_imagens (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  titulo_video text not null,
  prompt_usado text,
  url text not null,
  storage_path text not null,
  position int default 0,
  aspect_ratio text default '16:9',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_yt_imgs_tenant on youtube_video_imagens(tenant_id, created_at desc);
create index if not exists idx_yt_imgs_titulo on youtube_video_imagens(titulo_video);

create table if not exists youtube_thumbnails (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  canal_referencia_id uuid references youtube_canais_minerados(id) on delete set null,
  titulo text not null,
  prompt_usado text,
  padroes_detectados jsonb default '{}'::jsonb,        -- analise Claude Vision do canal referencia
  url text not null,
  storage_path text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_yt_thumbs_tenant on youtube_thumbnails(tenant_id, created_at desc);

alter table youtube_audios enable row level security;
alter table youtube_video_imagens enable row level security;
alter table youtube_thumbnails enable row level security;

do $$ begin create policy "yt_audios_all" on youtube_audios for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin create policy "yt_imgs_all" on youtube_video_imagens for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin create policy "yt_thumbs_all" on youtube_thumbnails for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
