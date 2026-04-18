-- ============================================================
-- MIGRATION 021: IA autoatendimento + variações de copy + conversas
-- ============================================================

-- variação de copy por mensagem (A/B testing)
ALTER TABLE disparo_mensagens ADD COLUMN IF NOT EXISTS variacao int DEFAULT 0;
ALTER TABLE disparo_mensagens ADD COLUMN IF NOT EXISTS variacao_label text;

-- conversas do autoatendimento (historico por lead)
CREATE TABLE IF NOT EXISTS disparo_conversas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES prospeccao_leads(id) ON DELETE SET NULL,
  mensagem_id uuid REFERENCES disparo_mensagens(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  role text NOT NULL DEFAULT 'user',          -- user, assistant
  content text NOT NULL,
  etapa_funil text,                           -- novo, respondeu, qualificado, agendou, negociando, ganho, perdido
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disparo_conv_tel ON disparo_conversas(telefone, created_at);
CREATE INDEX IF NOT EXISTS idx_disparo_conv_lead ON disparo_conversas(lead_id);

-- stats de variação por campanha
ALTER TABLE disparo_campanhas ADD COLUMN IF NOT EXISTS variacoes_stats jsonb DEFAULT '{}'::jsonb;

ALTER TABLE disparo_conversas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "disp_conv_all" ON disparo_conversas FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
