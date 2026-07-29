-- @class: online-safe
-- @requires-backup: false
-- @author: spec-089
-- @created: 2026-07-29
-- @description: Identifica capas gerenciadas e preserva exclusao pendente segura.

ALTER TABLE download_material_metadata
  ADD COLUMN IF NOT EXISTS cover_storage_provider VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cover_public_id TEXT,
  ADD COLUMN IF NOT EXISTS cover_width INTEGER,
  ADD COLUMN IF NOT EXISTS cover_height INTEGER,
  ADD COLUMN IF NOT EXISTS cover_mime_type VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cover_pending_delete_public_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_download_cover_dimensions_positive'
  ) THEN
    ALTER TABLE download_material_metadata
      ADD CONSTRAINT chk_download_cover_dimensions_positive
      CHECK (
        (cover_width IS NULL AND cover_height IS NULL)
        OR (cover_width > 0 AND cover_height > 0)
      );
  END IF;
END $$;
