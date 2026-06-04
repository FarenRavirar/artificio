-- @class: manual-risk
-- @requires-backup: true
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 105: Alinha system_suggestions ao contrato real do código
-- Problema: coluna suggestion_type vs node_type, falta rejection_reason
-- Solução: RENAME coluna se necessário, DROP constraint antiga, ADD nova constraint

-- Renomear suggestion_type para node_type se necessário
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_suggestions' AND column_name = 'suggestion_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_suggestions' AND column_name = 'node_type'
  ) THEN
    ALTER TABLE system_suggestions RENAME COLUMN suggestion_type TO node_type;
    RAISE NOTICE 'Renamed column: suggestion_type -> node_type';
  END IF;
END $$;

-- Remover constraint antiga de suggestion_type se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_suggestions_suggestion_type_check') THEN
    ALTER TABLE system_suggestions DROP CONSTRAINT system_suggestions_suggestion_type_check;
    RAISE NOTICE 'Dropped constraint: system_suggestions_suggestion_type_check';
  END IF;
  
  -- Remover constraint antiga de node_type se existir (para idempotência)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_suggestions_node_type_check') THEN
    ALTER TABLE system_suggestions DROP CONSTRAINT system_suggestions_node_type_check;
    RAISE NOTICE 'Dropped existing constraint: system_suggestions_node_type_check';
  END IF;
END $$;

-- Adicionar constraint nova com valores corretos
ALTER TABLE system_suggestions
  ADD CONSTRAINT system_suggestions_node_type_check
  CHECK (node_type IN ('system', 'edition', 'variant', 'subsystem'));

-- Adicionar colunas faltantes
ALTER TABLE system_suggestions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE system_suggestions ADD COLUMN IF NOT EXISTS user_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE system_suggestions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Validação: verificar que constraint e colunas foram criadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'system_suggestions_node_type_check' 
    AND conrelid = 'system_suggestions'::regclass
  ) THEN
    RAISE EXCEPTION 'Migration 105 failed: constraint not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_suggestions' AND column_name = 'rejection_reason'
  ) THEN
    RAISE EXCEPTION 'Migration 105 failed: rejection_reason column not created';
  END IF;
  
  RAISE NOTICE 'Migration 105 completed successfully';
END $$;
