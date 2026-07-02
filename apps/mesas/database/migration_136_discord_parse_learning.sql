-- @class: online-safe
-- @requires-backup: false
-- @author: spec-058
-- @created: 2026-07-01
-- @description: Fase 1 parser learning: casos de parse versionados e feedback
--               humano imutavel sem alterar comportamento do importador.

BEGIN;

CREATE TABLE IF NOT EXISTS discord_parse_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_message_id UUID NULL REFERENCES discord_import_messages(id) ON DELETE SET NULL,
  import_message_id UUID NULL REFERENCES import_messages(id) ON DELETE SET NULL,
  draft_id UUID NULL REFERENCES discord_import_table_drafts(id) ON DELETE SET NULL,
  import_run_id UUID NULL REFERENCES discord_import_runs(id) ON DELETE SET NULL,
  guild_id TEXT NULL,
  channel_id TEXT NULL,
  author_id TEXT NULL,
  raw_hash TEXT NOT NULL,
  normalized_hash TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  deterministic_result_json JSONB NULL,
  retrieval_context_json JSONB NULL,
  llm_context_hash TEXT NULL,
  final_result_json JSONB NULL,
  final_action TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  prompt_version TEXT NULL,
  model TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_parse_cases_final_action_check
    CHECK (final_action IN ('draft', 'needs_review', 'discard', 'ignore', 'synced', 'rejected', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_discord_message_id
  ON discord_parse_cases(discord_message_id);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_import_message_id
  ON discord_parse_cases(import_message_id);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_draft_id
  ON discord_parse_cases(draft_id);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_raw_hash
  ON discord_parse_cases(raw_hash);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_normalized_hash
  ON discord_parse_cases(normalized_hash);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_created_at
  ON discord_parse_cases(created_at DESC);

CREATE TABLE IF NOT EXISTS discord_parse_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parse_case_id UUID NULL REFERENCES discord_parse_cases(id) ON DELETE SET NULL,
  draft_id UUID NULL REFERENCES discord_import_table_drafts(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL,
  field TEXT NULL,
  before_value JSONB NULL,
  after_value JSONB NULL,
  reason TEXT NULL,
  scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_parse_feedback_type_check
    CHECK (feedback_type IN ('field_correction', 'status_change', 'discard', 'undiscard', 'duplicate', 'not_duplicate', 'ignore', 'publish'))
);

CREATE INDEX IF NOT EXISTS idx_discord_parse_feedback_parse_case_id
  ON discord_parse_feedback(parse_case_id);

CREATE INDEX IF NOT EXISTS idx_discord_parse_feedback_draft_id
  ON discord_parse_feedback(draft_id);

CREATE INDEX IF NOT EXISTS idx_discord_parse_feedback_created_at
  ON discord_parse_feedback(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_parse_cases'
  ) THEN
    RAISE EXCEPTION 'migration_136 falhou: tabela discord_parse_cases nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_parse_feedback'
  ) THEN
    RAISE EXCEPTION 'migration_136 falhou: tabela discord_parse_feedback nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_parse_cases' AND column_name = 'normalized_hash'
  ) THEN
    RAISE EXCEPTION 'migration_136 falhou: coluna normalized_hash nao criada';
  END IF;

  RAISE NOTICE 'migration_136: discord_parse_cases + discord_parse_feedback ok';
END $$;

COMMIT;
