-- ============================================================
-- MIGRATION 026: Vídeos IA (HeyGen avatar)
-- ============================================================

-- Avatares disponíveis (cache da API HeyGen + custom user uploads)
CREATE TABLE IF NOT EXISTS heygen_avatares (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  avatar_id text NOT NULL,              -- ID do HeyGen
  nome text NOT NULL,
  preview_url text,
  gender text,                          -- male, female, non-binary
  idioma text,                          -- pt-BR, en-US
  is_custom boolean DEFAULT false,       -- true se for avatar criado pelo usuário
  is_ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avatares_tenant ON heygen_avatares(tenant_id);

-- Vozes disponíveis (cache HeyGen)
CREATE TABLE IF NOT EXISTS heygen_vozes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  voice_id text NOT NULL,
  nome text NOT NULL,
  idioma text,
  gender text,
  preview_url text,
  is_ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_voice_id ON heygen_vozes(voice_id);

-- Vídeos gerados
CREATE TABLE IF NOT EXISTS videos_ia (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titulo text,
  script text NOT NULL,
  avatar_id text,
  voice_id text,
  idioma text DEFAULT 'pt-BR',
  heygen_video_id text,
  video_url text,
  thumbnail_url text,
  duracao_segundos int,
  formato text DEFAULT '9:16',          -- 9:16 (Reels/TikTok), 16:9 (YouTube), 1:1 (feed)
  status text DEFAULT 'processando',    -- processando, pronto, erro, cancelado
  fonte text DEFAULT 'manual',           -- manual, ia, clonagem
  tags text[] DEFAULT '{}',
  observacoes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  concluido_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_videos_tenant ON videos_ia(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos_ia(status);

ALTER TABLE heygen_avatares ENABLE ROW LEVEL SECURITY;
ALTER TABLE heygen_vozes ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos_ia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "avatares_all" ON heygen_avatares FOR ALL
  USING (tenant_id IS NULL OR tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "vozes_all" ON heygen_vozes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "videos_tenant" ON videos_ia FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
