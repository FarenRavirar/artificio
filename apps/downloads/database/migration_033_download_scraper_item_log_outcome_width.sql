-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-089
-- @created: 2026-07-28
-- @description: Alarga outcome e torna falhas de log visiveis na run do scraper.

-- T5.5 encontrou 83 falhas reais de auditoria na recoleta: o valor permitido
-- `skipped_not_portuguese` tem 22 caracteres, mas migration_022 criou a
-- coluna como VARCHAR(20). O ingest preservou os contadores do run, porém
-- perdeu todas as linhas rejeitadas e invalidou ground truth por item.
DO $$
DECLARE
  current_length integer;
BEGIN
  SELECT character_maximum_length
  INTO current_length
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'download_scraper_item_log'
    AND column_name = 'outcome';

  IF current_length IS NULL THEN
    RAISE EXCEPTION 'download_scraper_item_log.outcome ausente';
  END IF;

  IF current_length < 32 THEN
    ALTER TABLE download_scraper_item_log
      ALTER COLUMN outcome TYPE VARCHAR(32);
  END IF;
END
$$;

-- O try/catch de logItem preserva o outcome real do item quando a auditoria
-- falha. A run precisa guardar contador + último erro para a falha não morrer
-- somente no stderr efêmero do container.
ALTER TABLE download_scraper_run
  ADD COLUMN IF NOT EXISTS item_log_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_log_error_detail TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'download_scraper_item_log'
      AND column_name = 'outcome'
      AND character_maximum_length >= 22
  ) THEN
    RAISE EXCEPTION 'download_scraper_item_log.outcome continua menor que skipped_not_portuguese';
  END IF;
END
$$;
