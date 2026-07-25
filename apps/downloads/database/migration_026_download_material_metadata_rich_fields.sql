-- @class: online-safe
-- @requires-backup: false
-- @author: spec-086
-- @created: 2026-07-25
-- @description: Campos de metadata rica extraida de fontes externas

ALTER TABLE download_material_metadata
  ADD COLUMN IF NOT EXISTS file_size_text TEXT NULL,
  ADD COLUMN IF NOT EXISTS page_count INTEGER NULL,
  ADD COLUMN IF NOT EXISTS creation_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_category TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description_html TEXT NULL;
