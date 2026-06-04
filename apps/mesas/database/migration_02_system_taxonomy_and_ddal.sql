-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_02_system_taxonomy_and_ddal.sql
-- Taxonomia hierárquica de sistemas + aliases + campos DDAL em mesas
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- systems: árvore hierárquica
-- -----------------------------------------------------------------------------
ALTER TABLE systems ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE systems ADD COLUMN IF NOT EXISTS node_type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE systems ADD COLUMN IF NOT EXISTS depth SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE systems ADD COLUMN IF NOT EXISTS path_slug TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'systems_parent_fk'
  ) THEN
    ALTER TABLE systems
      ADD CONSTRAINT systems_parent_fk
      FOREIGN KEY (parent_id)
      REFERENCES systems(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'systems_node_type_check'
  ) THEN
    ALTER TABLE systems
      ADD CONSTRAINT systems_node_type_check
      CHECK (node_type IN ('system', 'edition', 'variant', 'subsystem'));
  END IF;
END $$;

UPDATE systems
SET path_slug = slug
WHERE path_slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_systems_parent ON systems(parent_id);
CREATE INDEX IF NOT EXISTS idx_systems_path_slug ON systems(path_slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_systems_path_slug ON systems(path_slug);

-- -----------------------------------------------------------------------------
-- aliases de sistema
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_slug TEXT NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (system_id, alias_slug)
);

CREATE INDEX IF NOT EXISTS idx_system_aliases_alias_slug ON system_aliases(alias_slug);

-- -----------------------------------------------------------------------------
-- tables: selo DDAL
-- -----------------------------------------------------------------------------
ALTER TABLE tables ADD COLUMN IF NOT EXISTS is_ddal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_code TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_name TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_tier SMALLINT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_season TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_duration TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_format TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_org_code TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_setting TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS ddal_rules_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_ddal_tier_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_ddal_tier_check
      CHECK (ddal_tier IS NULL OR (ddal_tier BETWEEN 1 AND 4));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_ddal_required_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_ddal_required_check
      CHECK (
        is_ddal = FALSE
        OR (
          ddal_code IS NOT NULL
          AND ddal_name IS NOT NULL
          AND ddal_tier IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tables_is_ddal ON tables(is_ddal);

COMMIT;
