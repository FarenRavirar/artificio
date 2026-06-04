-- @class: online-safe
-- @requires-backup: false
-- @author: sdd-001-refactor
-- @created: 2026-04-20
-- @description: Adiciona coluna applied_by em schema_migrations para rastreabilidade.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE schema_migrations
  ADD COLUMN IF NOT EXISTS applied_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schema_migrations' AND column_name='applied_by'
  ) THEN
    RAISE EXCEPTION 'migration falhou: applied_by não criada';
  END IF;
  RAISE NOTICE 'schema_migrations.applied_by: ok';
END $$;
