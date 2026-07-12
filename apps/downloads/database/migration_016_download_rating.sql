-- @class: online-safe
-- @requires-backup: false
-- @author: spec-074
-- @created: 2026-07-12
-- @description: Cria download_rating — avaliacao (nota 1-5 + comentario
--   opcional curto) por conta e material, uma por conta (D111 item 5).
--   Gate de escrita (so quem ja tem entrada em
--   download_user_material_download pode avaliar) fica no backend
--   (services/ratingGuard.ts), nao em constraint de banco.

CREATE TABLE IF NOT EXISTS download_rating (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL,
  user_id UUID NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_rating_user_material
  ON download_rating(user_id, material_id);

CREATE INDEX IF NOT EXISTS idx_download_rating_material
  ON download_rating(material_id);

DROP TRIGGER IF EXISTS set_updated_at ON download_rating;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON download_rating
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
