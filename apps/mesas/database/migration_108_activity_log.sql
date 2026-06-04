-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 108: activity_log
-- Objetivo: criar trilha de auditoria administrativa para o painel /gestao
-- Segurança: idempotente (CREATE TABLE/INDEX IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON activity_log (action);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON activity_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_actor
  ON activity_log (actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_target
  ON activity_log (target_user_id)
  WHERE target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_metadata_gin
  ON activity_log USING gin(metadata);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'activity_log'
  ) THEN
    RAISE EXCEPTION 'Migration 108 failed: activity_log table not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'activity_log' AND indexname = 'idx_activity_log_created_at'
  ) THEN
    RAISE EXCEPTION 'Migration 108 failed: idx_activity_log_created_at not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'activity_log' AND indexname = 'idx_activity_log_action'
  ) THEN
    RAISE EXCEPTION 'Migration 108 failed: idx_activity_log_action not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'activity_log' AND indexname = 'idx_activity_log_entity'
  ) THEN
    RAISE EXCEPTION 'Migration 108 failed: idx_activity_log_entity not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'activity_log' AND indexname = 'idx_activity_log_actor'
  ) THEN
    RAISE EXCEPTION 'Migration 108 failed: idx_activity_log_actor not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'activity_log' AND indexname = 'idx_activity_log_target'
  ) THEN
    RAISE EXCEPTION 'Migration 108 failed: idx_activity_log_target not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'activity_log' AND indexname = 'idx_activity_log_metadata_gin'
  ) THEN
    RAISE EXCEPTION 'Migration 108 failed: idx_activity_log_metadata_gin not created';
  END IF;

  RAISE NOTICE 'Migration 108 (activity_log) completed successfully';
END $$;
