-- @class: online-safe
-- @requires-backup: false
-- @author: sdd-017-parser-refinements-imagens
-- @created: 2026-05-11
-- @description: adiciona status auditavel de upload de imagens Discord em drafts.

ALTER TABLE discord_import_table_drafts
  ADD COLUMN IF NOT EXISTS image_upload_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS image_upload_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_upload_last_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS image_upload_last_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_discord_import_table_drafts_image_upload_retry
  ON discord_import_table_drafts (image_upload_status, image_upload_attempts)
  WHERE image_upload_status IN ('expired_url', 'network', 'cloudinary');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_table_drafts'
      AND column_name = 'image_upload_status'
  ) THEN
    RAISE EXCEPTION 'migration_122 falhou: image_upload_status nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_table_drafts'
      AND column_name = 'image_upload_attempts'
  ) THEN
    RAISE EXCEPTION 'migration_122 falhou: image_upload_attempts nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_table_drafts'
      AND column_name = 'image_upload_last_error'
  ) THEN
    RAISE EXCEPTION 'migration_122 falhou: image_upload_last_error nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_table_drafts'
      AND column_name = 'image_upload_last_at'
  ) THEN
    RAISE EXCEPTION 'migration_122 falhou: image_upload_last_at nao criada';
  END IF;

  RAISE NOTICE 'migration_122: status de upload de imagem Discord aplicado';
END $$;
