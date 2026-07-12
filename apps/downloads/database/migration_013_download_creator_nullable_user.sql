-- @class: online-safe
-- @requires-backup: false
-- @author: spec-073
-- @created: 2026-07-12
-- @description: Torna download_creator.user_id nullable (DEB-073-01) para
--   suportar credito de criador sem conta accounts associada (criterio de
--   aceite 5 da 073 / T3.2 da 061). Indice unico de user_id vira parcial
--   (so aplica quando nao-nulo) para permitir varios creditos-only sem
--   violar unicidade em NULL.

ALTER TABLE download_creator
  ALTER COLUMN user_id DROP NOT NULL;

DROP INDEX IF EXISTS idx_download_creator_user;

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_creator_user
  ON download_creator(user_id)
  WHERE user_id IS NOT NULL;
