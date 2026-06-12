-- @class: online-safe
-- @requires-backup: false
-- @author: spec-015-glossario-sso-compat
-- @created: 2026-06-11
-- @description: Account-linking SSO accounts. -> coluna aditiva sso_user_id + indice lower(email) para resolveLocalUser.

-- Aditiva e idempotente. Nada destrutivo (online-safe). Vincula users legados ao
-- id do SSO (token.sub do accounts). NULL ate o 1o login/reivindicacao.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sso_user_id TEXT;

-- Unicidade do vinculo: cada sso_user_id no maximo 1 usuario local.
-- (UNIQUE parcial ignora NULLs -> varios legados sem vinculo convivem.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_sso_user_id
  ON public.users (sso_user_id)
  WHERE sso_user_id IS NOT NULL;

-- Resolucao por email case-insensitive (account-linking por email + lookup do verify).
CREATE INDEX IF NOT EXISTS idx_users_lower_email
  ON public.users (lower(email));

-- Verificacao de pos-condicao (falha a migration se a coluna nao existir).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'sso_user_id'
  ) THEN
    RAISE EXCEPTION 'migration_13 falhou: users.sso_user_id nao criada';
  END IF;
  RAISE NOTICE 'migration_13 sso_link: ok';
END $$;
