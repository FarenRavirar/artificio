-- @class: online-safe
-- @requires-backup: false
-- @author: bugfix-500-resolve-system-suggestion
-- @created: 2026-07-18
-- @description: remove FKs obsoletas de system_suggestions para systems/system_aliases locais e corrige tipo de created_alias_id (UUID->TEXT), quebradas em Prod desde a spec 078 (Central Site Prod).

-- Migration 123 (2026-06-01) assumia `systems`/`system_aliases` locais como
-- fonte unica de sistemas de RPG. Spec 078 (2026-07-15) mudou Mesas Prod para
-- consumir o catalogo central (site-prod) via HTTP; resolveCreateSystem/
-- resolveCreateAlias/resolveCreateChain/resolveCreateChild/resolveMergeExisting
-- (systemSuggestionsAdmin.ts) passaram a gravar UUIDs/slugs do Central em
-- resolved_system_id/created_system_id/created_alias_id, que nunca existem na
-- tabela systems/system_aliases local em Prod (Central-backed). Toda resolucao
-- de sugestao com create_system/create_alias em Prod quebrava a FK e caia em
-- 500 generico (erro real mascarado por resolveErrorResponse). Integridade
-- referencial desses campos passa a ser responsabilidade do
-- SystemCatalogProvider (systemCatalogProvider.ts), nao mais do Postgres --
-- mesmo padrao ja adotado pelo resto da spec 078 para o dominio de sistemas.

ALTER TABLE system_suggestions
  DROP CONSTRAINT IF EXISTS system_suggestions_resolved_system_id_fkey,
  DROP CONSTRAINT IF EXISTS system_suggestions_created_system_id_fkey,
  DROP CONSTRAINT IF EXISTS system_suggestions_created_alias_id_fkey;

-- resolveCreateAlias (systemSuggestionsAdmin.ts) grava o slug normalizado do
-- alias em created_alias_id (nao ha endpoint de alias-id proprio no catalogo
-- central); coluna era UUID (linha do antigo system_aliases local), incompativel
-- com slug string -- causaria "invalid input syntax for type uuid" no mesmo
-- fluxo. Vira TEXT para aceitar o slug.
ALTER TABLE system_suggestions
  ALTER COLUMN created_alias_id TYPE TEXT USING created_alias_id::TEXT;

-- Validacao: garantir que as 3 constraints nao existem mais.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN (
      'system_suggestions_resolved_system_id_fkey',
      'system_suggestions_created_system_id_fkey',
      'system_suggestions_created_alias_id_fkey'
    )
    AND conrelid = 'system_suggestions'::regclass
  ) THEN
    RAISE EXCEPTION 'migration_155 falhou: FK obsoleta ainda presente em system_suggestions';
  END IF;

  RAISE NOTICE 'migration_155: FKs obsoletas de system_suggestions -> systems/system_aliases locais removidas';
END $$;
