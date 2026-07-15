-- @class: online-safe
-- @requires-backup: false
-- @author: spec-078
-- @created: 2026-07-15
-- @description: Adiciona origem e lifecycle soft à projeção local de sistemas RPG.

ALTER TABLE systems
  ADD COLUMN IF NOT EXISTS catalog_source TEXT NOT NULL DEFAULT 'beta',
  ADD COLUMN IF NOT EXISTS catalog_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS merged_into_id UUID NULL,
  ADD COLUMN IF NOT EXISTS central_version BIGINT NULL,
  ADD COLUMN IF NOT EXISTS central_synced_at TIMESTAMPTZ NULL;

ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS systems_catalog_source_check;
ALTER TABLE systems
  ADD CONSTRAINT systems_catalog_source_check
  CHECK (catalog_source IN ('central', 'beta')) NOT VALID;
ALTER TABLE systems
  VALIDATE CONSTRAINT systems_catalog_source_check;

ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS systems_catalog_status_check;
ALTER TABLE systems
  ADD CONSTRAINT systems_catalog_status_check
  CHECK (catalog_status IN ('active', 'archived', 'merged')) NOT VALID;
ALTER TABLE systems
  VALIDATE CONSTRAINT systems_catalog_status_check;

ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS systems_merged_into_fk;
ALTER TABLE systems
  ADD CONSTRAINT systems_merged_into_fk
  FOREIGN KEY (merged_into_id) REFERENCES systems(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE systems
  VALIDATE CONSTRAINT systems_merged_into_fk;

ALTER TABLE systems
  DROP CONSTRAINT IF EXISTS systems_merge_shape_check;
ALTER TABLE systems
  ADD CONSTRAINT systems_merge_shape_check CHECK (
    (catalog_status = 'merged' AND merged_into_id IS NOT NULL)
    OR (catalog_status <> 'merged' AND merged_into_id IS NULL)
  ) NOT VALID;
ALTER TABLE systems
  VALIDATE CONSTRAINT systems_merge_shape_check;

-- Soft lifecycle permite caminho arquivado ser reutilizado pelo substituto
-- ativo sem apagar o registro histórico.
ALTER TABLE systems DROP CONSTRAINT IF EXISTS systems_slug_key;
ALTER TABLE systems DROP CONSTRAINT IF EXISTS systems_path_slug_key;
DROP INDEX CONCURRENTLY IF EXISTS uq_systems_path_slug;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_systems_active_slug
  ON systems(slug) WHERE catalog_status = 'active';
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_systems_active_path_slug
  ON systems(path_slug) WHERE catalog_status = 'active' AND path_slug IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_systems_catalog_status
  ON systems(catalog_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_systems_catalog_source_version
  ON systems(catalog_source, central_version);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_systems_merged_into_id
  ON systems(merged_into_id) WHERE merged_into_id IS NOT NULL;
