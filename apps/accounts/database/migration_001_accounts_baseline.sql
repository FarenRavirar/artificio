-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-07-30
-- @description: Baseline idempotente do schema inline anterior do accounts

-- NAO adicionar `avatar_source` aqui. A coluna existe em producao desde
-- 2026-06-29, mas esta baseline descreve o schema como o codigo o definia quando
-- a esteira assumiu — e o codigo, apos o restore `a7d9d20`, nao a tinha. Quem
-- reconcilia disco e banco e a `migration_004`, que roda depois e e no-op em
-- prod. Editar um arquivo ja aplicado quebraria a idempotencia da ledger
-- (AGENTS.md §Migrations item 2).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  ciphertext TEXT NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A baseline executa tanto em banco existente quanto vazio. O runner grava
-- migration_001 na ledger somente depois deste preflight passar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_secrets' AND column_name = 'ciphertext'
  ) THEN
    RAISE EXCEPTION 'accounts baseline incompleta';
  END IF;
END $$;
