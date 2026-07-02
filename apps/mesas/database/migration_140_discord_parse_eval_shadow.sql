-- @class: online-safe
-- @requires-backup: false
-- @author: spec-058
-- @created: 2026-07-02
-- @description: Fase 7 parser learning: shadow por camada e suporte a eval offline.

CREATE TABLE IF NOT EXISTS discord_parse_shadow_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parse_case_id UUID NULL REFERENCES discord_parse_cases(id) ON DELETE SET NULL,
  draft_id UUID NULL REFERENCES discord_import_table_drafts(id) ON DELETE SET NULL,
  prediction_layer TEXT NOT NULL,
  predicted_action TEXT NOT NULL,
  predicted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) NULL,
  reason_codes TEXT[] NULL,
  actual_action TEXT NULL,
  actual_payload JSONB NULL,
  actual_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discord_parse_shadow_decisions_layer_check
    CHECK (prediction_layer IN ('parser', 'learning', 'deepseek')),
  CONSTRAINT discord_parse_shadow_decisions_predicted_action_check
    CHECK (predicted_action IN ('draft', 'needs_review', 'discard', 'ignore', 'duplicate', 'synced', 'rejected', 'error')),
  CONSTRAINT discord_parse_shadow_decisions_actual_action_check
    CHECK (actual_action IS NULL OR actual_action IN ('draft', 'needs_review', 'discard', 'ignore', 'duplicate', 'not_duplicate', 'synced', 'rejected', 'publish', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_discord_parse_shadow_decisions_case
  ON discord_parse_shadow_decisions(parse_case_id);

CREATE INDEX IF NOT EXISTS idx_discord_parse_shadow_decisions_draft
  ON discord_parse_shadow_decisions(draft_id);

CREATE INDEX IF NOT EXISTS idx_discord_parse_shadow_decisions_layer_created
  ON discord_parse_shadow_decisions(prediction_layer, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_parse_shadow_decisions'
  ) THEN
    RAISE EXCEPTION 'migration_140 falhou: tabela discord_parse_shadow_decisions nao criada';
  END IF;

  RAISE NOTICE 'migration_140: discord_parse_shadow_decisions ok';
END $$;
