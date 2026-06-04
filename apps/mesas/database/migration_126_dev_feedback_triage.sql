-- @class: online-safe
-- @requires-backup: false
-- @author: codex
-- @created: 2026-06-02
-- @description: arquivar/excluir/mesclar feedback de desenvolvimento (Spec 024) - colunas archived_at, screenshot_public_id, merged_into, merged_sources

BEGIN;

ALTER TABLE dev_feedback
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS screenshot_public_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS merged_into UUID NULL REFERENCES dev_feedback(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_sources JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_dev_feedback_archived_at ON dev_feedback(archived_at);

COMMENT ON COLUMN dev_feedback.archived_at IS 'Quando arquivado (some da lista ativa); NULL = ativo. Spec 024.';
COMMENT ON COLUMN dev_feedback.screenshot_public_id IS 'public_id Cloudinary da captura, para exclusao do asset junto do registro. Spec 024.';
COMMENT ON COLUMN dev_feedback.merged_into IS 'Destino quando este feedback foi mesclado (e arquivado) em outro. Spec 024.';
COMMENT ON COLUMN dev_feedback.merged_sources IS 'Snapshots dos feedbacks integrados neste destino pela mescla. Spec 024.';

COMMIT;
