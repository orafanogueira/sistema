-- ============================================================
-- Migration 010 - Maquina Maxxima (pipeline info-produto)
-- Mineira ofertas + validacao + ebook + criativos + campanha
-- ============================================================

do $$ begin
  create type maxxima_status as enum (
    'pesquisa',         -- mineirando ofertas
    'validando',        -- google trends, concorrencia
    'pronto_producao',  -- aprovado pra produzir
    'produzindo',       -- gerando ebook/criativos
    'pronto_campanha',  -- tudo produzido, pronto pra subir
    'rodando',          -- campanha no ar
    'pausado',
    'arquivado'
  );
exception when duplicate_object then null; end $$;

create table if not exists maxxima_ofertas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  nicho text,
  publico_alvo text,
  dor_principal text,
  promessa text,
  preco numeric(12,2),
  -- mineira
  fonte_descoberta text,           -- 'meta_library', 'manual', 'indicacao'
  meta_library_urls text[] default '{}',
  anuncios_ativos_dias int,         -- anuncios do concorrente ativos ha X dias
  concorrentes text[] default '{}',
  google_trends_score int,
  volume_busca int,
  -- validacao
  validado boolean default false,
  score_viabilidade int,            -- 0-100
  viabilidade_notes text,
  -- producao
  ebook_id uuid,                    -- referencia seo_content_items
  carrossel_ids uuid[] default '{}',
  reel_ids uuid[] default '{}',
  -- campanha
  campaign_budget numeric(12,2),
  campaign_structure jsonb,
  -- status
  status maxxima_status default 'pesquisa',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table maxxima_ofertas enable row level security;
drop policy if exists "mx_all" on maxxima_ofertas;
create policy "mx_all" on maxxima_ofertas for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

do $$ begin
  create trigger trg_mx_updated before update on maxxima_ofertas
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
