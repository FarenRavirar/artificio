-- @class: online-safe
-- @requires-backup: false
-- @author: spec-048-ws1
-- @created: 2026-06-27
-- @description: WS1 — cover_public_id para limpeza de imagens órfãs no Cloudinary

BEGIN;

ALTER TABLE discord_import_table_drafts
  ADD COLUMN IF NOT EXISTS cover_public_id TEXT;

CREATE INDEX IF NOT EXISTS idx_discord_import_table_drafts_cover_public_id
  ON discord_import_table_drafts(cover_public_id)
  WHERE cover_public_id IS NOT NULL;

-- Verificação de guarda
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_import_table_drafts'
    AND column_name = 'cover_public_id'
  ) THEN
    RAISE EXCEPTION 'migration_132 falhou: coluna cover_public_id nao criada';
  END IF;

  RAISE NOTICE 'migration_132: cover_public_id + índice ok';
END $$;

COMMIT;
