-- @class: online-safe
-- @requires-backup: false
-- @author: spec-062
-- @created: 2026-07-10
-- @description: Remove FOREIGN KEY tables.system_id -> systems(id) local. Achado CodeRabbit
--   (PR #145): systems local nao e mais fonte de verdade (spec 062, catalogo canonico central
--   no site) e o UUID retornado pelo catalogo central nunca existe em systems local, entao
--   qualquer insert/update de tables.system_id apontando pro catalogo central estourava 23503.
--   system_id passa a ser validado apenas pela aplicacao (catalogClient confere existencia
--   no catalogo central antes do insert/update), sem constraint cross-servico possivel (HTTP
--   externo, nao FK real).

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'tables'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'system_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tables DROP CONSTRAINT %I', fk_name);
    RAISE NOTICE 'migration_144: FK % removida de tables.system_id', fk_name;
  ELSE
    RAISE NOTICE 'migration_144: nenhuma FK encontrada em tables.system_id (idempotente)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'tables'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'system_id'
  ) THEN
    RAISE EXCEPTION 'migration_144 falhou: FK ainda presente em tables.system_id';
  END IF;

  RAISE NOTICE 'migration_144: tables.system_id livre de FK local, validado pela aplicacao via catalogo central';
END $$;
