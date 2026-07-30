-- @class: online-safe
-- @requires-backup: false
-- @author: spec-089
-- @created: 2026-07-30
-- @description: Generaliza denuncia para material ou comentario e registra sinal de abuso.

ALTER TABLE download_report
  ALTER COLUMN material_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES download_comment(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reporter_abuse_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reporter_dismissed_streak SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_download_report_single_target'
      AND conrelid = 'download_report'::regclass
  ) THEN
    ALTER TABLE download_report
      ADD CONSTRAINT chk_download_report_single_target
      CHECK ((material_id IS NOT NULL) <> (comment_id IS NOT NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_download_report_dismissed_streak_nonnegative'
      AND conrelid = 'download_report'::regclass
  ) THEN
    ALTER TABLE download_report
      ADD CONSTRAINT chk_download_report_dismissed_streak_nonnegative
      CHECK (reporter_dismissed_streak >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_report_reporter_material_unique
  ON download_report(reporter_user_id, material_id)
  WHERE reporter_user_id IS NOT NULL AND material_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_report_reporter_comment_unique
  ON download_report(reporter_user_id, comment_id)
  WHERE reporter_user_id IS NOT NULL AND comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_download_report_comment
  ON download_report(comment_id)
  WHERE comment_id IS NOT NULL;
