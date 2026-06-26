-- @class: online-safe
-- @requires-backup: false
-- @author: spec-048-tf8
-- @created: 2026-06-26
-- @description: Adiciona coluna reference para replies do DiscordChatExporter.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_messages'
      AND column_name = 'reference'
  ) THEN
    ALTER TABLE discord_import_messages ADD COLUMN reference JSONB;
    RAISE NOTICE 'migration_130: column reference added to discord_import_messages';
  ELSE
    RAISE NOTICE 'migration_130: column reference already exists, skipping';
  END IF;
END $$;
