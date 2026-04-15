-- ============================================================
-- MIGRATION 016: Produtos modulares (SaaS com venda separada por solucao)
-- ============================================================

create table if not exists products (
  key text primary key,
  name text not null,
  description text,
  tagline text,
  price_monthly numeric(10,2),
  price_yearly numeric(10,2),
  features text[] default '{}',
  modules text[] default '{}',           -- rotas/prefixos que esse produto libera
  icon text default 'sparkles',
  color text default '#06b6d4',
  position int default 0,
  is_active boolean default true,
  is_bundle boolean default false,        -- true pro produto "Completo"
  created_at timestamptz default now()
);

create table if not exists tenant_products (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_key text not null references products(key) on delete cascade,
  is_active boolean default true,
  started_at timestamptz default now(),
  expires_at timestamptz,
  asaas_subscription_id text,
  trial_ends_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique (tenant_id, product_key)
);
create index if not exists idx_tenant_products_tenant on tenant_products(tenant_id) where is_active = true;

-- coluna pra saber se tenant e master (Grupo Nogueira tem tudo)
alter table tenants add column if not exists is_master boolean default false;

-- garante que Grupo Nogueira eh master
update tenants set is_master = true
  where slug like 'grupo-nogueira%' and is_master is not true;

alter table products enable row level security;
alter table tenant_products enable row level security;

-- products eh catalogo publico (todos veem)
do $$ begin
  create policy "products_read_all" on products for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tp_all" on tenant_products for all
    using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

-- ============================================================
-- SEED DO CATALOGO
-- ============================================================

insert into products (key, name, tagline, description, price_monthly, price_yearly, features, modules, icon, color, position, is_bundle) values
('agencia', 'Agência Digital',
  'Gestão completa de clientes, social, tráfego e CRM',
  'Módulo base pra agências de marketing. Dashboard CEO, clientes, social media, calendário, leads, pipelines, automações, copiloto IA.',
  597.00, 5970.00,
  array['Dashboard CEO', 'Gestão de clientes', 'Social Media multi-plataforma', 'Calendário editorial', 'CRM + Pipelines', 'Automações', 'Copiloto IA', 'Criativos IA', 'Relatórios automáticos'],
  array['/dashboard','/clientes','/social','/calendario','/leads','/pipelines','/automacoes','/copiloto','/criativos','/rastreamento','/jornadas','/links-rastreaveis','/kanban','/financeiro','/contratos','/cobrancas','/assinaturas','/atendimento-ia','/agentes-ia','/utm-builder','/customer-success','/seo','/automacoes-ig','/followup','/conversas','/integracoes'],
  'Building2', '#06b6d4', 1, false),

('automotivo', 'Solução Automotiva',
  'CRM e operação pra lojas de veículos',
  'Gestão de estoque de veículos, vendedores, integração com 14 portais (WebMotors, iCarros, OLX, etc), vendas consignadas, IA de atendimento com simulação de financiamento.',
  497.00, 4970.00,
  array['Estoque de veículos', 'Gestão de vendedores', 'Integração 14 portais', 'Consignação', 'IA com simulação de financiamento', 'Fotos do veículo IA', 'Jornadas comerciais'],
  array['/estoque','/vendedores'],
  'Car', '#f59e0b', 2, false),

('comercial', 'Prospecção Ativa B2B',
  'Fábrica de leads + operação comercial',
  'Minerador de empresas via Google Places, kanban de prospecção, agentes IA de script de ligação e mensagem WhatsApp, dashboard de produtividade comercial, agendamento de reuniões.',
  497.00, 4970.00,
  array['Minerador Google Places (BR + EUA)', 'Kanban de prospecção', 'IA script de ligação', 'IA mensagem WhatsApp (3 variações)', 'Dashboard produtividade', 'Agendamento de reuniões'],
  array['/prospeccao'],
  'Phone', '#10b981', 3, false),

('youtube', 'YouTube IA',
  'Fábrica de vídeos + mineração de canais',
  'Minerador de canais oportunidade, Google Trends, gerador de títulos magnéticos SEO, descrição + tags, roteiro magnético Dotti-style, geração de voz, imagens, thumbnails e animação.',
  697.00, 6970.00,
  array['Minerador de canais oportunidade', 'Google Trends comparativo', 'Títulos magnéticos SEO', 'Descrição + 500 chars tags', 'Roteiro magnético com hooks', 'Gerador de voz ElevenLabs', 'Gerador de imagens', 'Thumbnails magnéticas', 'Animação IA + upload direto'],
  array['/youtube'],
  'Youtube', '#ef4444', 4, false),

('infoprodutos', 'Máquina de Infoprodutos',
  'Validação + criação de low-ticket em escala',
  'Metodologia Maxxima: cadastra oferta → sistema valida automaticamente → gera ebook IA de 5 capítulos → pipeline de produção.',
  397.00, 3970.00,
  array['Validador automático de ofertas', 'Score de oportunidade', 'Gerador de ebook IA (5 caps)', 'Pipeline de produção', 'Metodologia Maxxima embutida'],
  array['/maxxima'],
  'Zap', '#8b5cf6', 5, false),

('completo', 'Sistema Completo',
  'Tudo em um só lugar com desconto',
  'Acesso total a todas as soluções: Agência + Automotivo + Comercial + YouTube + Infoprodutos.',
  1997.00, 19970.00,
  array['Tudo dos outros 5 planos', 'Onboarding premium', 'Suporte prioritário', 'Treinamento inicial ao vivo', 'White-label disponível'],
  array['*'],
  'Crown', '#fbbf24', 0, true)

on conflict (key) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  features = excluded.features,
  modules = excluded.modules,
  color = excluded.color,
  position = excluded.position,
  is_bundle = excluded.is_bundle;

-- da produto "completo" pros tenants master (Grupo Nogueira)
insert into tenant_products (tenant_id, product_key, is_active)
  select id, 'completo', true from tenants where is_master = true
  on conflict (tenant_id, product_key) do update set is_active = true;
