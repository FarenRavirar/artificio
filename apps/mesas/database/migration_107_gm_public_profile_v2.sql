-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 107: gm_public_profile_v2
-- Objetivo: preparar o schema para o redesign da página pública do mestre
-- Segurança: idempotente (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)

ALTER TABLE gm_profiles
  ADD COLUMN IF NOT EXISTS tagline VARCHAR(200),
  ADD COLUMN IF NOT EXISTS promo_badge_text VARCHAR(120),
  ADD COLUMN IF NOT EXISTS selling_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS closed_group_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS closed_group_systems UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS closed_group_description TEXT,
  ADD COLUMN IF NOT EXISTS closed_group_min_price_cents INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gm_profiles_closed_group_min_price_cents_nonnegative'
  ) THEN
    ALTER TABLE gm_profiles
      ADD CONSTRAINT gm_profiles_closed_group_min_price_cents_nonnegative
      CHECK (
        closed_group_min_price_cents IS NULL
        OR closed_group_min_price_cents >= 0
      );
  END IF;
END $$;

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_links
  ADD COLUMN IF NOT EXISTS embed_url TEXT;

CREATE INDEX IF NOT EXISTS idx_tables_gm_featured_created
  ON tables (gm_id, featured DESC, created_at DESC)
  WHERE status = 'active';
