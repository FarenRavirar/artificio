-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 104: Unifica CHECK em systems.node_type (conflito M02 vs M11)
-- Problema: M02 aceita 'subsystem', M11 recusa
-- Solução: DROP ambas constraints conflitantes, ADD única constraint com todos os valores

DO $$
BEGIN
  -- Remove constraint antiga de M02 se existir
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'systems_node_type_check') THEN
    ALTER TABLE systems DROP CONSTRAINT systems_node_type_check;
    RAISE NOTICE 'Dropped constraint: systems_node_type_check';
  END IF;

  -- Remove constraint antiga de M11 se existir
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_node_type') THEN
    ALTER TABLE systems DROP CONSTRAINT check_node_type;
    RAISE NOTICE 'Dropped constraint: check_node_type';
  END IF;
END $$;

-- Adiciona constraint unificada com todos os valores válidos
ALTER TABLE systems
  ADD CONSTRAINT systems_node_type_check
  CHECK (node_type IN ('system', 'edition', 'variant', 'subsystem'));

-- Validação: verificar que constraint foi criada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'systems_node_type_check' 
    AND conrelid = 'systems'::regclass
  ) THEN
    RAISE EXCEPTION 'Migration 104 failed: constraint not created';
  END IF;
  RAISE NOTICE 'Migration 104 completed successfully';
END $$;
