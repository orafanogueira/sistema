-- ============================================================
-- MIGRATION 024: Múltiplos números Vapi com seleção por país
-- ============================================================

CREATE TABLE IF NOT EXISTS vapi_numeros (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,                         -- "US Main", "BR São Paulo"
  vapi_phone_number_id text NOT NULL,         -- UUID do Vapi
  telefone text NOT NULL,                     -- +1717..., +5511...
  country_code text NOT NULL,                 -- BR, US, MX, etc
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,           -- fallback se nenhum país bater
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vapi_numeros_tenant ON vapi_numeros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vapi_numeros_country ON vapi_numeros(country_code, is_active);

ALTER TABLE vapi_numeros ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "vapi_numeros_tenant" ON vapi_numeros FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- só 1 default por tenant
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vapi_default_per_tenant
  ON vapi_numeros(tenant_id) WHERE is_default = true;

-- referência em ligacoes pra saber qual número foi usado
ALTER TABLE ligacoes ADD COLUMN IF NOT EXISTS vapi_numero_id uuid REFERENCES vapi_numeros(id) ON DELETE SET NULL;
