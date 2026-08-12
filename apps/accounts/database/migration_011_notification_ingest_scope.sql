-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-08-12
-- @description: Amplia CHECK de scopes em community_service_credential com notification.write, escopo da rota de ingestao de evento externo que faz downloads e mesas virarem produtores do par consolidado

-- T3.13. Idempotente (roda 2x sem erro). online-safe: sem DROP TABLE/COLUMN,
-- sem TRUNCATE, sem DELETE FROM. DROP CONSTRAINT IF EXISTS e permitido em
-- online-safe (AGENTS.md §Migrations §2).
--
-- Requisito 13a-i (spec.md:244): `download_notification` e `notifications` do
-- mesas "viram produtores do par consolidado e param de ser fonte propria".
-- Produzir evento de outro modulo exige rota backend-to-backend
-- (`POST /internal/v1/notifications/events`), e toda rota `/internal/v1/*`
-- e guardada por escopo de credencial (`contrato-http-v1.md` §14). Nenhum dos
-- 7 escopos de migration_007:72-80 serve:
--
--   - `comment.write` autoriza criar fala em nome de usuario. Um modulo que so
--     precisa avisar "seu material foi aprovado" nao pode ganhar isso junto.
--   - `moderation.write` e mais forte ainda: decide caso de moderacao.
--
-- Escopo proprio e o que permite ao `downloads` emitir notificacao sem poder
-- comentar nem moderar — a granularidade que migration_007:85-88 nomeia como a
-- razao de existir da tabela.

-- ============================================================================
-- 1. Ampliar CHECK de scopes
-- ============================================================================

-- migration_007 declarou o CHECK inline, sem nome — o nome real e gerado pelo
-- Postgres (`community_service_credential_scopes_check`). Localiza por definicao, nao por
-- nome, mesmo padrao ja usado em migration_010 para o CHECK de `source_app`.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'community_service_credential'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%scopes%'
    AND pg_get_constraintdef(oid) LIKE '%users.read%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE community_service_credential DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'community_service_credential'::regclass
      AND conname = 'community_service_credential_scopes_consolidated_check'
  ) THEN
    ALTER TABLE community_service_credential
      ADD CONSTRAINT community_service_credential_scopes_consolidated_check
      CHECK (
        cardinality(scopes) > 0
        AND scopes <@ ARRAY[
          'users.read',
          'secrets.read',
          'comment.write',
          'comment.read',
          'vote.write',
          'report.write',
          'moderation.write',
          'notification.write'
        ]::TEXT[]
        AND community_text_array_has_no_duplicate(scopes)
      );
  END IF;
END
$$;

DO $$
BEGIN
  RAISE NOTICE 'migration_011: notification.write scope ok';
END
$$;
