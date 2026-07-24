-- @class: online-safe
-- @requires-backup: false
-- @author: spec-084
-- @created: 2026-07-24
-- @description: Achado de review PR #193 (codex) — migration_021 ja
--   aplicada em bancos existentes (beta/prod) mantem o CHECK antigo de
--   download_email_log.status (sem 'sending'), pois editar o
--   CREATE TABLE IF NOT EXISTS de migration_021 nao altera constraint ja
--   materializada. Sem esta migration, o claim atomico de emailLog.ts
--   (UPDATE ... SET status = 'sending') falha com violacao de CHECK em
--   qualquer banco que ja tinha a tabela antes desta mudanca.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_email_log_status_check'
  ) THEN
    ALTER TABLE download_email_log DROP CONSTRAINT download_email_log_status_check;
  END IF;
END $$;

ALTER TABLE download_email_log
  ADD CONSTRAINT download_email_log_status_check
  CHECK (status IN ('sent', 'failed', 'skipped_no_email', 'sending'));
