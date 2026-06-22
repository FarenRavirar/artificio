-- @class: online-safe
-- @requires-backup: false
-- @author: spec-047-deb-08
-- @created: 2026-06-22
-- @description: Criar import_corrections para corpus de treino do inbox

BEGIN;

CREATE TABLE IF NOT EXISTS import_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES discord_import_table_drafts(id) ON DELETE CASCADE,
  import_message_id UUID REFERENCES import_messages(id) ON DELETE CASCADE,
  raw_text TEXT,
  parsed_before JSONB NOT NULL,
  human_corrected JSONB NOT NULL,
  diff JSONB NOT NULL,
  reason TEXT,
  corrected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_corrections_draft_id ON import_corrections(draft_id);
CREATE INDEX IF NOT EXISTS idx_import_corrections_created_at ON import_corrections(created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'import_corrections'
  ) THEN
    RAISE EXCEPTION 'migration_129 falhou: tabela import_corrections nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_corrections' AND column_name = 'diff'
  ) THEN
    RAISE EXCEPTION 'migration_129 falhou: coluna diff nao criada em import_corrections';
  END IF;

  RAISE NOTICE 'migration_129: import_corrections ok';
END $$;

COMMIT;
