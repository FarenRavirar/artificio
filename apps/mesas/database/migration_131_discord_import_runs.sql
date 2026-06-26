-- @class: online-safe
-- @requires-backup: false
-- @author: spec-048-t-g6-t-g7
-- @created: 2026-06-26
-- @description: T-G6 métricas + T-G7 shadow mode

BEGIN;

-- T-G6: métricas por rodada de importação
CREATE TABLE IF NOT EXISTS discord_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind TEXT NOT NULL DEFAULT 'discord_chat_exporter_json',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_messages INTEGER NOT NULL DEFAULT 0,
  drafts_created INTEGER NOT NULL DEFAULT 0,
  drafts_updated INTEGER NOT NULL DEFAULT 0,
  messages_ignored INTEGER NOT NULL DEFAULT 0,
  messages_failed INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_discord_import_runs_started_at ON discord_import_runs(started_at);

-- T-G7: shadow mode
CREATE TABLE IF NOT EXISTS discord_shadow_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES discord_import_table_drafts(id) ON DELETE CASCADE,
  confidence NUMERIC(4,3),
  confidence_tier TEXT,
  would_auto_approve BOOLEAN NOT NULL DEFAULT false,
  auto_approve_reason TEXT,
  missing_fields TEXT[],
  actual_outcome TEXT,
  actual_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_shadow_decisions_draft_id ON discord_shadow_decisions(draft_id);
CREATE INDEX IF NOT EXISTS idx_discord_shadow_decisions_created_at ON discord_shadow_decisions(created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_import_runs'
  ) THEN
    RAISE EXCEPTION 'migration_131 falhou: tabela discord_import_runs nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_shadow_decisions'
  ) THEN
    RAISE EXCEPTION 'migration_131 falhou: tabela discord_shadow_decisions nao criada';
  END IF;

  RAISE NOTICE 'migration_131: discord_import_runs + discord_shadow_decisions ok';
END $$;

COMMIT;
