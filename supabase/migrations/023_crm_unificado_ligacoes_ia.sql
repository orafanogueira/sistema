-- ============================================================
-- MIGRATION 023: CRM unificado + ligações IA (Vapi.ai)
-- ============================================================

-- origem do lead (pra CRM gerencial filtrar)
ALTER TABLE prospeccao_leads ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE prospeccao_leads ADD COLUMN IF NOT EXISTS origem_detalhe text;
ALTER TABLE prospeccao_leads ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE prospeccao_leads ADD COLUMN IF NOT EXISTS valor_estimado numeric;
ALTER TABLE prospeccao_leads ADD COLUMN IF NOT EXISTS ultimo_contato timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_origem ON prospeccao_leads(origem);
CREATE INDEX IF NOT EXISTS idx_leads_ultimo_contato ON prospeccao_leads(ultimo_contato);

-- tabela de ligações (humanas ou IA)
CREATE TABLE IF NOT EXISTS ligacoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES prospeccao_leads(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  nome text,
  tipo text DEFAULT 'manual',         -- manual, ia_vapi, ia_bland, ia_retell
  status text DEFAULT 'pendente',     -- pendente, em_andamento, atendida, sem_resposta, recusada, erro
  script_usado text,
  duracao_segundos int,
  transcript text,
  resumo_ia text,
  resultado text,                     -- qualificado, agendou, sem_interesse, callback
  gravacao_url text,
  vapi_call_id text,
  custo_estimado numeric,
  observacoes text,
  agendada_para timestamptz,
  realizada_em timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ligacoes_tenant ON ligacoes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ligacoes_lead ON ligacoes(lead_id);
CREATE INDEX IF NOT EXISTS idx_ligacoes_status ON ligacoes(status);

-- filas de ligação (listas que vão ser chamadas)
CREATE TABLE IF NOT EXISTS ligacoes_filas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text DEFAULT 'ia_vapi',        -- ia_vapi, manual
  script text,
  voice_id text,
  assistant_id text,                  -- Vapi assistant ID
  total_contatos int DEFAULT 0,
  total_realizadas int DEFAULT 0,
  total_qualificados int DEFAULT 0,
  status text DEFAULT 'rascunho',     -- rascunho, ativa, pausada, concluida
  criado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- associa ligações a filas
ALTER TABLE ligacoes ADD COLUMN IF NOT EXISTS fila_id uuid REFERENCES ligacoes_filas(id) ON DELETE SET NULL;

ALTER TABLE ligacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ligacoes_filas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "ligacoes_tenant" ON ligacoes FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "ligacoes_filas_tenant" ON ligacoes_filas FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
