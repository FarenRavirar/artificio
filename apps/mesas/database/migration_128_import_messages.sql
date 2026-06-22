-- @class: online-safe
-- @requires-backup: false
-- @author: spec-047
-- @created: 2026-06-22
-- @description: Criar import_messages para Inbox de Importação de Mesas

BEGIN;

-- Tabela nova: mensagens de multiplas origens (texto colado, JSON, etc.)
CREATE TABLE IF NOT EXISTS import_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'manual_paste',
  raw_text TEXT,
  content_raw TEXT NOT NULL,
  thread_name TEXT,
  metadata JSONB DEFAULT '{}',
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_messages_status ON import_messages(status);
CREATE INDEX IF NOT EXISTS idx_import_messages_source_type ON import_messages(source_type);
CREATE INDEX IF NOT EXISTS idx_import_messages_content_hash ON import_messages(content_hash);

-- Tabela existente: adaptar discord_import_table_drafts para FK polimorfica
ALTER TABLE discord_import_table_drafts
  ADD COLUMN IF NOT EXISTS import_message_id UUID REFERENCES import_messages(id) ON DELETE CASCADE;

ALTER TABLE discord_import_table_drafts
  ALTER COLUMN discord_message_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discord_import_table_drafts_import_message_id
  ON discord_import_table_drafts(import_message_id);

-- Cada draft deve ter exatamente uma origem: Discord OU Inbox.
ALTER TABLE discord_import_table_drafts
  DROP CONSTRAINT IF EXISTS chk_discord_import_table_drafts_single_origin;

ALTER TABLE discord_import_table_drafts
  ADD CONSTRAINT chk_discord_import_table_drafts_single_origin CHECK (
    (discord_message_id IS NOT NULL AND import_message_id IS NULL)
    OR (discord_message_id IS NULL AND import_message_id IS NOT NULL)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'import_messages'
  ) THEN
    RAISE EXCEPTION 'migration_128 falhou: tabela import_messages nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_table_drafts'
      AND column_name = 'import_message_id'
  ) THEN
    RAISE EXCEPTION 'migration_128 falhou: coluna import_message_id nao criada em discord_import_table_drafts';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_table_drafts'
      AND column_name = 'discord_message_id'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'migration_128 falhou: discord_message_id ainda e NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_discord_import_table_drafts_single_origin'
      AND conrelid = 'discord_import_table_drafts'::regclass
  ) THEN
    RAISE EXCEPTION 'migration_128 falhou: constraint de origem unica nao criada';
  END IF;

  RAISE NOTICE 'migration_128: import_messages criada, discord_import_table_drafts adaptada para FK polimorfica';
END $$;

COMMIT;
