-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 106: Adiciona action_url e metadata JSONB em notifications
-- Problema: Notificação sem caminho de ação é dead-end operacional
-- Solução: ADD action_url TEXT + metadata JSONB + índice GIN

-- Adicionar colunas
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Criar índice GIN para queries futuras por metadata
-- Ex: SELECT * FROM notifications WHERE metadata->>'system_id' = 'uuid'
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin
  ON notifications USING gin(metadata);

-- Validação: verificar que colunas e índice foram criados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'action_url'
  ) THEN
    RAISE EXCEPTION 'Migration 106 failed: action_url column not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    RAISE EXCEPTION 'Migration 106 failed: metadata column not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notifications' AND indexname = 'idx_notifications_metadata_gin'
  ) THEN
    RAISE EXCEPTION 'Migration 106 failed: GIN index not created';
  END IF;
  
  RAISE NOTICE 'Migration 106 completed successfully';
END $$;
