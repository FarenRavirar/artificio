-- @class: online-safe
-- @requires-backup: false
-- @author: spec-105
-- @created: 2026-10-12
-- @description: fingerprint de table_metric_events passa a aceitar nulo para anonimizar evento antigo

-- Spec 105 M2. `table_metric_events` passou a ser a serie temporal de
-- view/click/contact/favorite por mesa. O script de limpeza antigo APAGAVA todo
-- evento com mais de 48 h, o que mataria a serie. O fingerprint (hash de IP+UA)
-- so serve para o dedupe, cuja maior janela e 24 h (favorite); depois disso ele
-- e dado pessoal sem uso. O script passa a anular o fingerprint apos 48 h e a
-- manter a linha. `DROP NOT NULL` e permitido em online-safe (deploy-flow.md §3).

ALTER TABLE table_metric_events ALTER COLUMN fingerprint_hash DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_metric_events'
      AND column_name = 'fingerprint_hash'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Migration 168 failed: fingerprint_hash still NOT NULL';
  END IF;
END $$;
