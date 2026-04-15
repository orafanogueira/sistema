-- ============================================================
-- MIGRATION 018: YouTube trilhas sonoras (PiAPI Suno)
-- ============================================================

create table if not exists youtube_trilhas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  tipo text default 'background',         -- background, abertura, musica_completa
  prompt_descricao text not null,          -- o que foi pedido (user friendly)
  prompt_suno text,                        -- prompt final enviado pro Suno
  letra text,                              -- se tiver letra
  instrumental boolean default true,
  titulo_variacao text,
  duracao_sec numeric(8,2),
  url text not null,
  storage_path text not null,
  url_variacao_2 text,
  task_id text,                            -- id no PiAPI (pra retry/status)
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_yt_trilhas_tenant on youtube_trilhas(tenant_id, created_at desc);

alter table youtube_trilhas enable row level security;
do $$ begin create policy "yt_trilhas_all" on youtube_trilhas for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
