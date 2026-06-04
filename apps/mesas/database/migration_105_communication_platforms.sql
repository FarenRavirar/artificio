-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 105: Plataformas de comunicação estruturadas
-- Cria tabela communication_platforms e adiciona referência em tables

CREATE TABLE IF NOT EXISTS communication_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed inicial
INSERT INTO communication_platforms (name, slug, sort_order)
VALUES
  ('Discord', 'discord', 1),
  ('Google Meet', 'google-meet', 2),
  ('Microsoft Teams', 'microsoft-teams', 3),
  ('Telegram', 'telegram', 4),
  ('Zoom', 'zoom', 5)
ON CONFLICT (slug) DO NOTHING;

-- Coluna de referência estruturada na tabela de mesas
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS communication_platform_id UUID REFERENCES communication_platforms(id);

-- Backfill de plataformas legadas (texto livre)
WITH legacy_platforms AS (
  SELECT DISTINCT TRIM(communication_platform) AS legacy_name
  FROM tables
  WHERE communication_platform IS NOT NULL
    AND TRIM(communication_platform) <> ''
), inserted_platforms AS (
  INSERT INTO communication_platforms (name, slug, sort_order)
  SELECT
    lp.legacy_name,
    LOWER(REGEXP_REPLACE(lp.legacy_name, '[^a-zA-Z0-9]+', '-', 'g')),
    1000
  FROM legacy_platforms lp
  ON CONFLICT (slug) DO NOTHING
  RETURNING id
)
SELECT COUNT(*) FROM inserted_platforms;

UPDATE tables t
SET communication_platform_id = cp.id
FROM communication_platforms cp
WHERE t.communication_platform_id IS NULL
  AND t.communication_platform IS NOT NULL
  AND TRIM(t.communication_platform) <> ''
  AND LOWER(TRIM(t.communication_platform)) = LOWER(cp.name);

CREATE INDEX IF NOT EXISTS idx_communication_platforms_active
  ON communication_platforms (is_active, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_tables_communication_platform_id
  ON tables (communication_platform_id);

COMMENT ON TABLE communication_platforms IS 'Plataformas de comunicação para mesas online/híbridas';
COMMENT ON COLUMN tables.communication_platform_id IS 'Referência para plataforma de comunicação estruturada';
