-- ============================================================
-- MIGRATION 022: Google Calendar OAuth + agendamentos
-- ============================================================

-- Tokens OAuth por usuário
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  email text,
  calendar_id text DEFAULT 'primary',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_gcal_tokens_tenant ON google_calendar_tokens(tenant_id);

-- Agendamentos gerados pela IA
CREATE TABLE IF NOT EXISTS agendamentos_ia (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES prospeccao_leads(id) ON DELETE SET NULL,
  mensagem_id uuid REFERENCES disparo_mensagens(id) ON DELETE SET NULL,
  telefone text,
  lead_nome text,
  data_hora timestamptz NOT NULL,
  duracao_min int DEFAULT 15,
  meet_link text,
  gcal_event_id text,
  status text DEFAULT 'agendado',      -- agendado, cancelado, realizado, nao_compareceu
  criado_pela_ia boolean DEFAULT true,
  observacoes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agend_ia_tenant ON agendamentos_ia(tenant_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_agend_ia_tel ON agendamentos_ia(telefone);

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos_ia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "gcal_tokens_own" ON google_calendar_tokens FOR ALL
  USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "agend_ia_tenant" ON agendamentos_ia FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
