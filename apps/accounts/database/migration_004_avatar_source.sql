-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-07-31
-- @description: Declara users.avatar_source, que existe em producao fora da esteira

-- DRIFT REVERSO REAL, achado em 2026-07-31 lendo o banco de producao.
--
-- `users.avatar_source` (TEXT NOT NULL DEFAULT 'google') existe em
-- `accounts-db` desde 2026-06-29 e nao era declarada por nenhuma migration nem
-- pelo codigo: `c051971` a criou pelo `migrate.ts` inline, e `a7d9d20`
-- ("restore ultimo runtime verde do SSO", 5h depois) reescreveu `users.ts` a
-- partir de um ponto anterior, levando junto a definicao. A coluna ficou no
-- banco; a declaracao, nao. A baseline `001` foi escrita a partir do codigo, e
-- por isso tambem nao a tem — ou seja, um banco recriado a partir da esteira
-- nasceria SEM esta coluna, divergente de producao.
--
-- Esta migration nao muda producao (a coluna ja esta la, com esta definicao
-- exata, e as 103 contas tem 'google'). Ela existe para que disco e banco
-- passem a concordar: em prod e no-op, em banco novo cria a coluna que prod tem.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_source TEXT NOT NULL DEFAULT 'google';

-- Contrato do valor. Criada NOT VALID + VALIDATE em seguida pelo mesmo motivo de
-- `002`/`003` (E015): o runner envolve cada arquivo em uma transacao, e separar
-- a varredura do ADD evita segurar lock de escrita na tabela `users` — a tabela
-- do SSO, tocada por cada login.
--
-- Os literais 'google'/'custom' repetem de proposito (Sonar acusa duplicacao):
-- os tres usos tem papeis distintos — DEFAULT da coluna, guarda de validacao
-- pre-constraint, e o proprio CHECK. Extrair para variavel PL/pgSQL tornaria o
-- DDL indireto e menos auditavel, que e o oposto do que se quer numa migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users WHERE avatar_source NOT IN ('google', 'custom')
  ) THEN
    RAISE EXCEPTION 'users.avatar_source contem valor fora do contrato';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_avatar_source_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_avatar_source_check
      CHECK (avatar_source IN ('google', 'custom')) NOT VALID;
  END IF;
END $$;
