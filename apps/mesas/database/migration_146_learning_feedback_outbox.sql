-- @class: online-safe
-- @requires-backup: false
-- @author: spec-077-onda-a
-- @created: 2026-07-14
-- @description: torna import_corrections uma outbox observavel/idempotente para
--               feedback humano; adiciona confirmacao e rejeicao humana de regra.

BEGIN;

ALTER TABLE import_corrections
  ADD COLUMN IF NOT EXISTS confirmed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Linhas históricas já foram tratadas pelo fluxo legado. Não entram na outbox.
  ADD COLUMN IF NOT EXISTS learning_status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS learning_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_error TEXT,
  ADD COLUMN IF NOT EXISTS learning_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS learning_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Somente correções criadas depois desta migration entram como trabalho novo.
ALTER TABLE import_corrections
  ALTER COLUMN learning_status SET DEFAULT 'pending';

ALTER TABLE import_corrections
  DROP CONSTRAINT IF EXISTS import_corrections_learning_status_check;
ALTER TABLE import_corrections
  ADD CONSTRAINT import_corrections_learning_status_check
  CHECK (learning_status IN ('pending', 'processing', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_import_corrections_learning_outbox
  ON import_corrections(learning_status, learning_updated_at)
  WHERE learning_status IN ('pending', 'failed');

ALTER TABLE discord_parse_feedback
  ADD COLUMN IF NOT EXISTS correction_id UUID NULL
    REFERENCES import_corrections(id) ON DELETE SET NULL;
ALTER TABLE discord_parse_feedback
  DROP CONSTRAINT IF EXISTS discord_parse_feedback_type_check;
ALTER TABLE discord_parse_feedback
  ADD CONSTRAINT discord_parse_feedback_type_check CHECK (
    feedback_type IN (
      'field_correction', 'field_confirmation', 'status_change', 'discard',
      'undiscard', 'duplicate', 'not_duplicate', 'ignore', 'publish'
    )
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_parse_feedback_correction_field
  ON discord_parse_feedback(correction_id, feedback_type, field)
  WHERE correction_id IS NOT NULL;

ALTER TABLE discord_learning_rule_applications
  DROP CONSTRAINT IF EXISTS discord_learning_rule_applications_outcome_check;
ALTER TABLE discord_learning_rule_applications
  ADD CONSTRAINT discord_learning_rule_applications_outcome_check CHECK (
    outcome IN ('applied', 'conflict', 'rejected_by_guard', 'rejected_by_human', 'shadow')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_corrections' AND column_name = 'learning_status'
  ) THEN
    RAISE EXCEPTION 'migration_146 falhou: learning_status ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_parse_feedback' AND column_name = 'correction_id'
  ) THEN
    RAISE EXCEPTION 'migration_146 falhou: correction_id ausente';
  END IF;
  RAISE NOTICE 'migration_146: learning feedback outbox ok';
END $$;

COMMIT;
