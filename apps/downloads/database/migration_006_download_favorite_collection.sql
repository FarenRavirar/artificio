-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_favorite, download_collection e
--   download_collection_item (061/spec.md MVP — favoritos/colecoes).

CREATE TABLE IF NOT EXISTS download_favorite (
  user_id UUID NOT NULL,
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, material_id)
);

CREATE TABLE IF NOT EXISTS download_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(160) NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_collection_user_slug
  ON download_collection(user_id, slug);

CREATE TABLE IF NOT EXISTS download_collection_item (
  collection_id UUID NOT NULL REFERENCES download_collection(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, material_id)
);
