-- @class: online-safe
-- @requires-backup: false
-- @author: sdd-012-discord-covil-sync
-- @created: 2026-05-03
-- @description: Cria tabelas de staging para pipeline de importacao Discord/Covil (fontes, mensagens brutas, drafts).

-- 1. Fontes de importacao (canais Discord autorizados)
CREATE TABLE IF NOT EXISTS discord_import_sources (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT        NOT NULL,
  channel_id          TEXT        NOT NULL,
  channel_name        TEXT,
  enabled             BOOLEAN     NOT NULL DEFAULT TRUE,
  auto_sync_enabled   BOOLEAN     NOT NULL DEFAULT FALSE,
  last_message_id     TEXT,
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_import_sources_channel_id_unique UNIQUE (channel_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_import_sources_guild_id
  ON discord_import_sources (guild_id);

CREATE INDEX IF NOT EXISTS idx_discord_import_sources_enabled
  ON discord_import_sources (enabled);

-- 2. Mensagens brutas importadas do Discord
CREATE TABLE IF NOT EXISTS discord_import_messages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id             UUID        NOT NULL REFERENCES discord_import_sources (id) ON DELETE CASCADE,
  discord_message_id    TEXT        NOT NULL,
  discord_channel_id    TEXT        NOT NULL,
  discord_guild_id      TEXT        NOT NULL,
  discord_author_id     TEXT,
  discord_author_name   TEXT,
  discord_message_url   TEXT,
  content_raw           TEXT        NOT NULL,
  attachments           JSONB       NOT NULL DEFAULT '[]',
  embeds                JSONB       NOT NULL DEFAULT '[]',
  message_created_at    TIMESTAMPTZ,
  message_edited_at     TIMESTAMPTZ,
  content_hash          TEXT        NOT NULL,
  source_kind           TEXT        NOT NULL DEFAULT 'discord_bot',
  status                TEXT        NOT NULL DEFAULT 'pending',
  parse_error           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_import_messages_channel_msg_unique UNIQUE (discord_channel_id, discord_message_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_import_messages_source_id
  ON discord_import_messages (source_id);

CREATE INDEX IF NOT EXISTS idx_discord_import_messages_status
  ON discord_import_messages (status);

CREATE INDEX IF NOT EXISTS idx_discord_import_messages_content_hash
  ON discord_import_messages (content_hash);

-- 3. Drafts parseados (JSON estruturado antes de virar mesa)
CREATE TABLE IF NOT EXISTS discord_import_table_drafts (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_message_id    UUID           NOT NULL REFERENCES discord_import_messages (id) ON DELETE CASCADE,
  table_id              UUID           REFERENCES tables (id) ON DELETE SET NULL,
  parsed_payload        JSONB          NOT NULL,
  normalized_payload    JSONB,
  confidence            NUMERIC(4, 3),
  status                TEXT           NOT NULL DEFAULT 'draft',
  review_notes          TEXT,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_import_table_drafts_message_id
  ON discord_import_table_drafts (discord_message_id);

CREATE INDEX IF NOT EXISTS idx_discord_import_table_drafts_table_id
  ON discord_import_table_drafts (table_id);

CREATE INDEX IF NOT EXISTS idx_discord_import_table_drafts_status
  ON discord_import_table_drafts (status);

-- 4. Validacao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_import_sources'
  ) THEN
    RAISE EXCEPTION 'migration falhou: discord_import_sources nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_import_messages'
  ) THEN
    RAISE EXCEPTION 'migration falhou: discord_import_messages nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_import_table_drafts'
  ) THEN
    RAISE EXCEPTION 'migration falhou: discord_import_table_drafts nao criada';
  END IF;

  RAISE NOTICE 'migration_115: discord_import_sources ok';
  RAISE NOTICE 'migration_115: discord_import_messages ok';
  RAISE NOTICE 'migration_115: discord_import_table_drafts ok';
END $$;
