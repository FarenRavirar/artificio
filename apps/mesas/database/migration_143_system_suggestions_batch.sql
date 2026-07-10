-- @class: online-safe
-- @requires-backup: false
-- @author: spec-062
-- @created: 2026-07-09
-- @description: Adiciona agrupamento de lote em system_suggestions para cadeias sistema-edicao-variante (I0a.10).

ALTER TABLE system_suggestions
  ADD COLUMN IF NOT EXISTS batch_id UUID NULL,
  ADD COLUMN IF NOT EXISTS batch_index INTEGER NULL,
  ADD COLUMN IF NOT EXISTS parent_suggestion_index INTEGER NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_suggestions_resolution_type_check'
      AND conrelid = 'system_suggestions'::regclass
  ) THEN
    ALTER TABLE system_suggestions
      DROP CONSTRAINT system_suggestions_resolution_type_check;
  END IF;

  ALTER TABLE system_suggestions
    ADD CONSTRAINT system_suggestions_resolution_type_check
    CHECK (
      resolution_type IS NULL
      OR resolution_type IN ('create_system', 'create_child', 'create_chain', 'create_alias', 'merge_existing', 'reject')
    );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_suggestions_batch_index_check'
      AND conrelid = 'system_suggestions'::regclass
  ) THEN
    ALTER TABLE system_suggestions
      ADD CONSTRAINT system_suggestions_batch_index_check
      CHECK (batch_index IS NULL OR batch_index >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_suggestions_parent_suggestion_index_check'
      AND conrelid = 'system_suggestions'::regclass
  ) THEN
    ALTER TABLE system_suggestions
      ADD CONSTRAINT system_suggestions_parent_suggestion_index_check
      CHECK (parent_suggestion_index IS NULL OR parent_suggestion_index >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_suggestions_batch_id
  ON system_suggestions (batch_id, batch_index)
  WHERE batch_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_suggestions' AND column_name = 'batch_id'
  ) THEN
    RAISE EXCEPTION 'migration_143 falhou: batch_id nao criada';
  END IF;

  RAISE NOTICE 'migration_143: lote de sugestoes de sistemas aplicado';
END $$;
