-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_04_publisher_role_and_contacts.sql
-- REQ-11: papel do publicador (mestre x anunciante)
-- REQ-12: canais de contato/recrutamento por mesa
-- =============================================================================

BEGIN;

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS publisher_role TEXT NOT NULL DEFAULT 'gm',
  ADD COLUMN IF NOT EXISTS actual_gm_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_publisher_role_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_publisher_role_check
      CHECK (publisher_role IN ('gm', 'announcer'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tables_announcer_requires_name'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_announcer_requires_name
      CHECK (
        publisher_role <> 'announcer'
        OR (actual_gm_name IS NOT NULL AND char_length(btrim(actual_gm_name)) >= 2)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS table_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT,
  discord_server_url TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT table_contacts_channel_check
    CHECK (channel IN ('whatsapp', 'discord', 'phone', 'email', 'facebook', 'instagram', 'form')),
  CONSTRAINT table_contacts_discord_server_only
    CHECK (discord_server_url IS NULL OR channel = 'discord')
);

CREATE INDEX IF NOT EXISTS idx_table_contacts_table_id
  ON table_contacts (table_id);

COMMIT;
