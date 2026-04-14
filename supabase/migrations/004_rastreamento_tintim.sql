-- ============================================================
-- Migration 004 - Rastreamento Tintim-like
-- Jornadas + keywords + short-links + pixel events
-- ============================================================

-- ============================================================
-- JORNADAS (etapas do funil de WhatsApp, configuravel por cliente)
-- ============================================================
create table if not exists jornadas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  name text not null default 'Jornada padrao',
  is_default boolean default false,
  created_at timestamptz default now(),
  unique (cliente_id, name)
);

create table if not exists jornada_etapas (
  id uuid primary key default uuid_generate_v4(),
  jornada_id uuid not null references jornadas(id) on delete cascade,
  name text not null,
  position int not null default 0,
  color text default '#64748b',
  is_won boolean default false,
  is_lost boolean default false,
  -- evento que dispara pro Meta quando lead entra nessa etapa
  meta_event text, -- Contact, Lead, Schedule, CompleteRegistration, Purchase, custom
  meta_custom_event text, -- se for custom
  -- evento Google Ads (nome da conversao configurada no Google)
  google_conversion_name text,
  -- se a etapa indica VENDA (pro extrator de valor agir)
  is_sale boolean default false,
  metadata jsonb default '{}'::jsonb
);
create index if not exists idx_etapas_jornada on jornada_etapas(jornada_id, position);

-- ============================================================
-- KEYWORDS - palavras/regex que movem lead automaticamente entre etapas
-- ============================================================
create table if not exists jornada_keywords (
  id uuid primary key default uuid_generate_v4(),
  etapa_id uuid not null references jornada_etapas(id) on delete cascade,
  pattern text not null,         -- texto ou regex
  is_regex boolean default false,
  case_sensitive boolean default false,
  -- sentido: 'in' = mensagem DO cliente, 'out' = mensagem PARA cliente
  direction text default 'any',  -- 'in', 'out', 'any'
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_keywords_etapa on jornada_keywords(etapa_id);

-- ============================================================
-- SHORT LINKS rastreaveis (tipo tintim.app/abc)
-- ============================================================
create table if not exists short_links (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  slug text not null unique,    -- 'abc' em /t/abc
  name text not null,            -- ex: 'site-tintim-app'
  -- destino: geralmente WhatsApp com mensagem pre-preenchida
  destination_url text not null, -- https://wa.me/55XXXX?text=...
  default_message text,
  utm jsonb default '{}'::jsonb,
  campaign_ref text,             -- ref livre pra correlacionar com campanhas
  is_active boolean default true,
  clicks_total int default 0,
  clicks_last_30d int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_shortlinks_cliente on short_links(cliente_id, is_active);

-- ============================================================
-- CLIQUES EM LINKS (snapshot de cada clique com metadata)
-- ============================================================
create table if not exists link_clicks (
  id uuid primary key default uuid_generate_v4(),
  short_link_id uuid not null references short_links(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  -- query string params capturados
  utm jsonb default '{}'::jsonb,
  fbclid text,
  gclid text,
  ttclid text,                  -- TikTok
  referrer text,
  -- device
  user_agent text,
  ip text,
  device_type text,             -- mobile, desktop, tablet
  os text,
  browser text,
  country text,
  region text,
  city text,
  -- correlacao
  session_id text,              -- cookie de session do link tracker
  created_at timestamptz default now()
);
create index if not exists idx_clicks_shortlink on link_clicks(short_link_id, created_at desc);
create index if not exists idx_clicks_session on link_clicks(session_id);

-- ============================================================
-- PAGE VIEWS (script JS embedado no site do cliente captura fbclid/gclid ANTES do clique)
-- ============================================================
create table if not exists page_views (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  url text not null,
  path text,
  title text,
  fbclid text,
  gclid text,
  ttclid text,
  utm jsonb default '{}'::jsonb,
  session_id text not null,
  user_agent text,
  ip text,
  referrer text,
  created_at timestamptz default now()
);
create index if not exists idx_pageviews_session on page_views(session_id, created_at desc);
create index if not exists idx_pageviews_cliente on page_views(cliente_id, created_at desc);

-- ============================================================
-- PIXEL EVENTS ENVIADOS (log de eventos Meta CAPI + Google Offline)
-- ============================================================
create table if not exists pixel_events (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  provider text not null,         -- 'meta_capi', 'google_offline'
  event_name text not null,        -- Contact, Lead, Purchase, etc
  external_event_id text,          -- id pra deduplicacao no Meta
  value numeric(12,2),
  currency text default 'BRL',
  status text default 'pending',   -- pending, sent, failed
  payload jsonb,
  response jsonb,
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_pixel_events_lead on pixel_events(lead_id);
create index if not exists idx_pixel_events_status on pixel_events(status, provider);

-- ============================================================
-- ADICIONA campos em leads pra rastreamento enriquecido
-- ============================================================
alter table leads add column if not exists jornada_id uuid references jornadas(id) on delete set null;
alter table leads add column if not exists jornada_etapa_id uuid references jornada_etapas(id) on delete set null;
alter table leads add column if not exists short_link_id uuid references short_links(id) on delete set null;
alter table leads add column if not exists session_id text;
alter table leads add column if not exists ttclid text;
alter table leads add column if not exists device_type text;
alter table leads add column if not exists os text;
alter table leads add column if not exists browser text;
alter table leads add column if not exists ip text;
alter table leads add column if not exists referrer text;
alter table leads add column if not exists campaign_id text;
alter table leads add column if not exists campaign_name text;
alter table leads add column if not exists adset_id text;
alter table leads add column if not exists adset_name text;
alter table leads add column if not exists ad_id text;
alter table leads add column if not exists ad_name text;
alter table leads add column if not exists valor_venda numeric(12,2);
alter table leads add column if not exists data_venda_detectada timestamptz;

-- ============================================================
-- HISTORICO DE MENSAGENS (leitura + keyword matching)
-- ============================================================
create table if not exists lead_messages (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  direction text not null,           -- 'in' (cliente) | 'out' (loja)
  channel text default 'whatsapp',   -- whatsapp, messenger, instagram
  content text,
  external_id text,                  -- id na plataforma
  matched_keywords text[] default '{}',
  value_extracted numeric(12,2),
  raw jsonb,
  received_at timestamptz default now()
);
create index if not exists idx_msgs_lead on lead_messages(lead_id, received_at desc);

-- ============================================================
-- CONFIGURACAO DE PIXEL/TAG POR CLIENTE
-- ============================================================
create table if not exists pixel_config (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid not null unique references clientes(id) on delete cascade,
  meta_pixel_id text,
  meta_access_token text,          -- token CAPI (pode ser System User token)
  meta_test_event_code text,       -- pra testar sem poluir producao
  google_ads_customer_id text,
  google_conversion_actions jsonb default '[]'::jsonb,
  -- [{name, google_conversion_action_id}]
  updated_at timestamptz default now()
);

-- ============================================================
-- TRIGGER - quando lead muda de etapa, dispara pixel event
-- (insere em pixel_events com status='pending', cron processa)
-- ============================================================
create or replace function trigger_pixel_on_stage_change() returns trigger as $$
declare
  etapa record;
begin
  if new.jornada_etapa_id is distinct from old.jornada_etapa_id and new.jornada_etapa_id is not null then
    select * into etapa from jornada_etapas where id = new.jornada_etapa_id;
    -- Meta event
    if etapa.meta_event is not null or etapa.meta_custom_event is not null then
      insert into pixel_events (
        cliente_id, lead_id, provider, event_name,
        external_event_id, value, currency, status, payload
      ) values (
        new.cliente_id, new.id, 'meta_capi',
        coalesce(etapa.meta_custom_event, etapa.meta_event),
        new.id::text || '_' || extract(epoch from now())::text,
        case when etapa.is_sale then new.valor_venda else null end,
        'BRL', 'pending',
        jsonb_build_object(
          'fbclid', new.fbclid, 'email', new.email, 'telefone', new.whatsapp,
          'nome', new.nome, 'cidade', new.cidade, 'estado', new.estado,
          'ip', new.ip, 'user_agent', new.browser
        )
      );
    end if;
    -- Google offline conversion
    if etapa.google_conversion_name is not null and new.gclid is not null then
      insert into pixel_events (
        cliente_id, lead_id, provider, event_name, value, currency, status, payload
      ) values (
        new.cliente_id, new.id, 'google_offline',
        etapa.google_conversion_name,
        case when etapa.is_sale then new.valor_venda else null end,
        'BRL', 'pending',
        jsonb_build_object('gclid', new.gclid)
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_pixel_on_stage_change after update on leads
    for each row execute function trigger_pixel_on_stage_change();
exception when duplicate_object then null; end $$;

-- ============================================================
-- TRIGGERS touch_updated_at
-- ============================================================
do $$ begin
  create trigger trg_pixel_config_updated before update on pixel_config
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table jornadas enable row level security;
alter table jornada_etapas enable row level security;
alter table jornada_keywords enable row level security;
alter table short_links enable row level security;
alter table link_clicks enable row level security;
alter table page_views enable row level security;
alter table pixel_events enable row level security;
alter table lead_messages enable row level security;
alter table pixel_config enable row level security;

drop policy if exists "jornadas_all" on jornadas;
create policy "jornadas_all" on jornadas for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "etapas_all" on jornada_etapas;
create policy "etapas_all" on jornada_etapas for all
  using (exists(select 1 from jornadas j where j.id = jornada_id and user_has_tenant(j.tenant_id)))
  with check (exists(select 1 from jornadas j where j.id = jornada_id and user_has_tenant(j.tenant_id)));

drop policy if exists "keywords_all" on jornada_keywords;
create policy "keywords_all" on jornada_keywords for all
  using (exists(select 1 from jornada_etapas e join jornadas j on j.id = e.jornada_id where e.id = etapa_id and user_has_tenant(j.tenant_id)))
  with check (exists(select 1 from jornada_etapas e join jornadas j on j.id = e.jornada_id where e.id = etapa_id and user_has_tenant(j.tenant_id)));

drop policy if exists "shortlinks_all" on short_links;
create policy "shortlinks_all" on short_links for all using (user_has_tenant(tenant_id)) with check (user_has_tenant(tenant_id));

drop policy if exists "clicks_read" on link_clicks;
create policy "clicks_read" on link_clicks for select
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));

drop policy if exists "pageviews_read" on page_views;
create policy "pageviews_read" on page_views for select using (user_has_tenant(tenant_id));

drop policy if exists "pixel_events_read" on pixel_events;
create policy "pixel_events_read" on pixel_events for select
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));

drop policy if exists "msgs_read" on lead_messages;
create policy "msgs_read" on lead_messages for select
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));

drop policy if exists "pixel_config_all" on pixel_config;
create policy "pixel_config_all" on pixel_config for all
  using (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)))
  with check (exists(select 1 from clientes c where c.id = cliente_id and user_has_tenant(c.tenant_id)));
