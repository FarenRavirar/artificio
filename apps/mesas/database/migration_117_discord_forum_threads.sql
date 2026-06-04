-- @class: online-safe
-- @requires-backup: false
-- @author: sdd-015-discord-forum-threads
-- @created: 2026-05-04
-- @description: Adiciona metadados de tipo de canal e origem forum/thread ao Discord Sync.

-- 1. Fontes: tipo do canal selecionado pelo admin
ALTER TABLE discord_import_sources
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'text';

-- 2. Mensagens: origem forum/thread quando aplicavel
ALTER TABLE discord_import_messages
  ADD COLUMN IF NOT EXISTS discord_parent_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_thread_name TEXT;

CREATE INDEX IF NOT EXISTS idx_discord_import_sources_channel_type
  ON discord_import_sources (channel_type);

CREATE INDEX IF NOT EXISTS idx_discord_import_messages_thread_id
  ON discord_import_messages (discord_thread_id);

CREATE INDEX IF NOT EXISTS idx_discord_import_messages_parent_channel_id
  ON discord_import_messages (discord_parent_channel_id);

-- 3. Validacao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_sources'
      AND column_name = 'channel_type'
  ) THEN
    RAISE EXCEPTION 'migration falhou: channel_type nao criada em discord_import_sources';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_messages'
      AND column_name = 'discord_thread_id'
  ) THEN
    RAISE EXCEPTION 'migration falhou: discord_thread_id nao criada em discord_import_messages';
  END IF;

  RAISE NOTICE 'migration_117: discord forum/thread metadata ok';
END $$;
