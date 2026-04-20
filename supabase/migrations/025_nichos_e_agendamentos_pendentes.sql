-- ============================================================
-- MIGRATION 025: Nichos de prospecção + agendamentos com confirmação
-- ============================================================

-- Templates de nicho pra adaptar o script da Ana automaticamente
CREATE TABLE IF NOT EXISTS nichos_campanha (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,                       -- automotivo, clinicas-esteticas, advogados
  nome text NOT NULL,                       -- "Lojas de Carros"
  setor_descricao text NOT NULL,            -- "lojas de carros / multimarcas / revendas do setor automotivo"
  prova_social text NOT NULL,               -- "ajudou a vender mais de 10 mil carros em 2025"
  metrica_volume text NOT NULL,             -- "veículos vendidos por mês"
  pergunta_qualifica_volume text NOT NULL,  -- "Quantos veículos vocês vendem por mês?"
  metrica_resultado text NOT NULL,          -- "vendas de carros"
  exemplo_resultado text,                   -- "saiu de 20 pra 58 carros/mês"
  publico text,                             -- "donos de loja de carros"
  is_ativo boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nichos_tenant ON nichos_campanha(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nicho_slug_tenant ON nichos_campanha(tenant_id, slug);

ALTER TABLE nichos_campanha ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "nichos_tenant" ON nichos_campanha FOR ALL
  USING (tenant_id IS NULL OR tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Referência de nicho em campanhas de ligação
ALTER TABLE ligacoes_filas ADD COLUMN IF NOT EXISTS nicho_id uuid REFERENCES nichos_campanha(id) ON DELETE SET NULL;

-- Agendamentos pendentes de confirmação do Rafa
CREATE TABLE IF NOT EXISTS agendamentos_pendentes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES prospeccao_leads(id) ON DELETE SET NULL,
  mensagem_id uuid REFERENCES disparo_mensagens(id) ON DELETE SET NULL,
  telefone_lead text NOT NULL,
  nome_lead text,
  horario_proposto_texto text,             -- texto bruto do lead (ex: "terça 14h")
  horario_proposto_iso timestamptz,        -- parseado pro datetime se der
  status text DEFAULT 'aguardando_rafa',   -- aguardando_rafa, confirmado, rejeitado, expirado
  confirmado_at timestamptz,
  rejeitado_at timestamptz,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agend_pend_tel ON agendamentos_pendentes(telefone_lead, status);
CREATE INDEX IF NOT EXISTS idx_agend_pend_status ON agendamentos_pendentes(status, created_at);

ALTER TABLE agendamentos_pendentes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "agend_pend_tenant" ON agendamentos_pendentes FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed: nichos globais (tenant_id NULL = visível pra todos os tenants)
INSERT INTO nichos_campanha (tenant_id, slug, nome, setor_descricao, prova_social, metrica_volume, pergunta_qualifica_volume, metrica_resultado, exemplo_resultado, publico, is_default)
VALUES
  (NULL, 'automotivo', 'Lojas de Carros',
   'lojas de carros / multimarcas / revendas do setor automotivo',
   'ajudou a vender mais de 10 mil carros em 2025 com tráfego pago',
   'veículos vendidos por mês',
   'Quantos veículos vocês vendem por mês mais ou menos?',
   'vendas de carros',
   'uma loja parecida saiu de 20 pra 58 carros vendidos/mês em 60 dias',
   'donos de loja de carros',
   true),
  (NULL, 'clinicas-esteticas', 'Clínicas Estéticas',
   'clínicas de estética, harmonização facial, procedimentos estéticos',
   'ajudou a gerar mais de 20 mil agendamentos em clínicas estéticas em 2025',
   'pacientes atendidos por mês',
   'Quantos pacientes vocês atendem por mês mais ou menos?',
   'agendamentos de procedimentos',
   'uma clínica parecida saiu de 40 pra 120 agendamentos/mês com anúncio certo',
   'donos e gestores de clínicas estéticas',
   false),
  (NULL, 'odontologia', 'Dentistas e Clínicas Odontológicas',
   'consultórios e clínicas odontológicas',
   'ajudou a agendar mais de 15 mil consultas odontológicas em 2025',
   'pacientes novos por mês',
   'Quantos pacientes novos vocês atendem por mês?',
   'agendamentos de consultas',
   'uma clínica odontológica saiu de 30 pra 90 agendamentos/mês',
   'dentistas donos de clínica',
   false),
  (NULL, 'advocacia', 'Advogados',
   'escritórios de advocacia (tributário, trabalhista, previdenciário, família)',
   'ajudou escritórios a captar mais de 8 mil clientes qualificados em 2025',
   'clientes novos por mês',
   'Quantos clientes novos o escritório recebe por mês?',
   'captação de clientes',
   'um escritório saiu de 10 pra 35 clientes novos/mês com tráfego certo',
   'advogados donos de escritório',
   false),
  (NULL, 'ecommerce', 'E-commerce',
   'lojas virtuais e e-commerces',
   'ajudou e-commerces a faturar mais de 80 milhões em 2025 com tráfego pago',
   'faturamento mensal em vendas online',
   'Qual o faturamento mensal da loja online atualmente?',
   'vendas online e ROAS',
   'um e-commerce saiu de 80 mil pra 240 mil/mês de faturamento com Meta Ads',
   'donos de e-commerce',
   false),
  (NULL, 'imobiliario', 'Imobiliárias e Corretores',
   'imobiliárias, corretores de imóveis e construtoras',
   'ajudou a gerar mais de 12 mil leads qualificados pro mercado imobiliário em 2025',
   'imóveis vendidos ou leads qualificados por mês',
   'Quantos imóveis vocês fecham por mês mais ou menos?',
   'fechamento de vendas de imóveis',
   'uma imobiliária saiu de 8 pra 23 fechamentos/mês',
   'corretores e donos de imobiliária',
   false)
ON CONFLICT DO NOTHING;
