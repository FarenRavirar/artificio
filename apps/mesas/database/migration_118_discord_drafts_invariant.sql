-- @class: online-safe
-- @requires-backup: false
-- @author: sdd-016-discord-pipeline-rebuild
-- @created: 2026-05-10
-- @description: CHECK CONSTRAINT garante invariante status='ready' => missing_fields=[] em discord_import_table_drafts.

-- 1. Constraint idempotente (CHECK nao aceita IF NOT EXISTS nativo; consulta pg_constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discord_drafts_ready_requires_no_missing'
      AND conrelid = 'discord_import_table_drafts'::regclass
  ) THEN
    ALTER TABLE discord_import_table_drafts
      ADD CONSTRAINT discord_drafts_ready_requires_no_missing
      CHECK (
        status <> 'ready'
        OR COALESCE(jsonb_array_length(normalized_payload->'missing_fields'), 0) = 0
      );
  END IF;
END $$;

-- 2. Validacao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discord_drafts_ready_requires_no_missing'
      AND conrelid = 'discord_import_table_drafts'::regclass
  ) THEN
    RAISE EXCEPTION 'migration_118 falhou: constraint discord_drafts_ready_requires_no_missing nao criada';
  END IF;

  RAISE NOTICE 'migration_118: invariante ready=>missing=[] aplicado em discord_import_table_drafts';
END $$;
