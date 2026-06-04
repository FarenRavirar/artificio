-- @class: online-safe
-- @requires-backup: false
-- @author: sdd-018-resolucao-sugestoes-sistemas
-- @created: 2026-06-01
-- @description: auditoria de resolucao de sugestoes de sistemas (alias/edicao/variante/mescla/sistema novo).

-- Colunas de auditoria na propria system_suggestions (decisao 018: sem tabela paralela).
ALTER TABLE system_suggestions
  ADD COLUMN IF NOT EXISTS resolution_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS resolved_system_id UUID NULL REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_system_id UUID NULL REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_alias_id UUID NULL REFERENCES system_aliases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS resolution_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL;

-- Constraint de valores validos para resolution_type, criada apenas se ainda nao existir
-- (idempotente e sem instrucoes destrutivas, mantendo o status online-safe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_suggestions_resolution_type_check'
      AND conrelid = 'system_suggestions'::regclass
  ) THEN
    ALTER TABLE system_suggestions
      ADD CONSTRAINT system_suggestions_resolution_type_check
      CHECK (
        resolution_type IS NULL
        OR resolution_type IN ('create_system', 'create_child', 'create_alias', 'merge_existing', 'reject')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_suggestions_resolution_type
  ON system_suggestions (resolution_type);

-- Validacao: garantir que as colunas e a constraint existem.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_suggestions' AND column_name = 'resolution_type'
  ) THEN
    RAISE EXCEPTION 'migration_123 falhou: resolution_type nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_suggestions' AND column_name = 'resolution_payload'
  ) THEN
    RAISE EXCEPTION 'migration_123 falhou: resolution_payload nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_suggestions_resolution_type_check'
      AND conrelid = 'system_suggestions'::regclass
  ) THEN
    RAISE EXCEPTION 'migration_123 falhou: constraint resolution_type nao criada';
  END IF;

  RAISE NOTICE 'migration_123: auditoria de resolucao de sugestoes aplicada';
END $$;
