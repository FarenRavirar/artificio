-- @class: online-safe
-- @requires-backup: false
-- @author: spec-074
-- @created: 2026-07-12
-- @description: Cria download_user_material_download — registro de download
--   por conta (D111 item 7). Chave (user_id, material_id) unica: clique
--   logado no CTA so incrementa download_metric_daily na PRIMEIRA vez por
--   conta; cliques seguintes da mesma conta redirecionam mas nao contam de
--   novo (criterio de aceite 4 da 074). Tambem serve de fonte para o guard
--   de avaliacao (T6.2/spec 072, HasDownloadedChecker).

CREATE TABLE IF NOT EXISTS download_user_material_download (
  user_id UUID NOT NULL,
  material_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_download_user_material_download_material
  ON download_user_material_download(material_id);
