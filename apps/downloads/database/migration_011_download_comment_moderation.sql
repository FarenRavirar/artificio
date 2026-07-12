-- @class: online-safe
-- @requires-backup: false
-- @author: spec-072
-- @created: 2026-07-12
-- @description: Cria download_comment (comentario com conta obrigatoria,
--   retirada so por denuncia D111 item 6) e adiciona rejection_reason a
--   download_material (motivo estruturado obrigatorio em reprovacao, T3.3) e
--   auto_publish_enabled (flag/kill switch, desligada por padrao, D111 item
--   3 — sem criterio de liberacao implementado nesta spec).

ALTER TABLE download_material
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_publish_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS download_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  removed_at TIMESTAMPTZ,
  removed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_comment_material
  ON download_comment(material_id, created_at);
