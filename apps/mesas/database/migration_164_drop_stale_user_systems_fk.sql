-- @class: online-safe
-- @requires-backup: false
-- @author: bugfix-500-profile-systems
-- @created: 2026-08-27
-- @description: remove FK obsoleta user_systems_system_id_fkey -> systems local, quebrada em Prod desde a spec 078 (Central Site Prod); integridade passa a ser do SystemCatalogProvider, igual a tables/system_suggestions.

-- Mesmo bug da migration_155, em outra tabela: ela varreu system_suggestions e
-- deixou user_systems para tras. Migration_14 (2026-06) assumia `systems` local
-- como fonte unica; a spec 078 (2026-07-15) passou Mesas Prod a consumir o
-- catalogo central via HTTP, e o id que o usuario escolhe em GET /api/v1/systems
-- (systems.ts:80, getSystemCatalogProvider) nunca existe na tabela `systems`
-- local em Prod.
--
-- Sintoma medido em Prod (2026-08-27, mesas-api): POST /api/v1/profile/systems
-- em 500 repetido, com
--   insert or update on table "user_systems" violates foreign key constraint
--   "user_systems_system_id_fkey"
--   Key (system_id)=(6c763e71-e9d2-4ff5-8a61-cf3801089d9d) is not present in
--   table "systems".
-- O sistema EXISTE no catalogo central: profileService.addUserSystem ja valida
-- com systemExistsInCatalog (profileService.ts:332) e a validacao passa — quem
-- recusa e a FK na linha seguinte, apontando para o catalogo errado. Validacao e
-- FK olhavam para catalogos diferentes.
--
-- O caminho VIVO que a FK quebra e o perfil do usuario: profileService.
-- addUserSystem (profileService.ts:339), servindo POST /api/v1/profile/systems
-- (profile.ts:213). O id vem de GET /api/v1/systems, que serve o catalogo
-- central — entao TODA adicao de sistema ao perfil em Prod falha, nao um caso
-- de borda. As leituras/remocoes da mesma tabela (profileService.ts:82/349/365/
-- 377) nao dependem da FK.
--
-- Comparacao que fecha o diagnostico: `tables.system_id` guarda o mesmo tipo de
-- id central e NAO quebra, porque perdeu a FK local na migration_144. Os demais
-- campos de sistema (user_preferences.systems, gm_profiles.closed_group_systems)
-- tambem nunca tiveram FK. user_systems ficou como unica excecao.
--
-- (systemProjectionHydrator.ts e adminEnrichment.ts tambem escrevem nesta
-- tabela com id central, mas ambos estao aposentados — nao sustentam esta
-- migration, apenas confirmam que o id central sempre foi o esperado aqui.)
-- Varredura de pg_constraint em Prod (2026-08-27) confirmou que esta era a
-- UNICA FK externa remanescente para `systems`; as demais (systems_parent_fk,
-- systems_merged_into_fk, system_aliases_system_id_fkey) sao internas ao
-- catalogo local e permanecem coerentes.
--
-- Sem dado orfao: 21 linhas em user_systems, 0 sem correspondencia local
-- (medido antes da migration) — remover a constraint nao abandona vinculo.

ALTER TABLE user_systems
  DROP CONSTRAINT IF EXISTS user_systems_system_id_fkey;

-- Validacao: garantir que a constraint nao existe mais.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_systems_system_id_fkey'
      AND conrelid = 'user_systems'::regclass
  ) THEN
    RAISE EXCEPTION 'migration_164 falhou: FK obsoleta ainda presente em user_systems';
  END IF;

  RAISE NOTICE 'migration_164: FK obsoleta user_systems -> systems local removida';
END $$;
