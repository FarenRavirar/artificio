-- @class: online-safe
-- @requires-backup: false
-- @author: sessao-26-08-11_1-relatos-prod
-- @created: 2026-08-11
-- @description: autoria e motivo do encerramento de mesa (archived_by/closed_reason) para a tela "Mesa Encerrada"

-- Relato de produção (2026-08-11, visitante anônimo em
-- /mesas/odisseia-dos-lordes-dragoes-mrnnvpg5): mesa encerrada servia página em
-- branco. A tela nova precisa dizer QUANDO e POR QUEM foi encerrada, e o banco
-- só guardava `archived_at` — sem nenhuma coluna de autoria.
--
-- Medido antes de escrever esta migration:
--   - `tables` não tem `archived_by`, `closed_by` nem equivalente;
--   - `table_history` existe com o schema certo (`changed_by`/`field`/
--     `old_value`/`new_value`) e está VAZIA (0 linhas), sem nenhum escritor no
--     backend — schema morto, não serve como fonte.
--
-- Consequência aceita: para as mesas JÁ encerradas (40 importadas expiradas +
-- 24 arquivadas na medição de hoje) a autoria é irrecuperável — o dado nunca
-- foi gravado. `archived_by` fica NULL nelas, e a tela degrada para o motivo
-- derivado do estado, sem nome. Backfill inventado seria pior que ausência.

-- Quem encerrou. FK para `users` e não para `gm_profiles`: administração
-- encerra sem ser dona da mesa, e o GM que encerra a própria também é um user.
-- `ON DELETE SET NULL` porque a conta pode sumir e o registro do encerramento
-- deve sobreviver — perder a data por causa do autor seria trocar um dado por
-- nenhum.
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Por que encerrou. Deliberadamente TEXT com CHECK, não enum: `table_status`
-- já existe e descreve o ESTADO da mesa (`active`/`ended`/`cancelled`), que é
-- coisa diferente de QUEM/POR QUE a tirou do ar. Enum novo exigiria migration
-- para cada motivo futuro; o CHECK aceita ampliação sem reescrever tipo.
--
--   gm            — o próprio mestre arquivou/encerrou
--   admin         — administração encerrou (moderação, denúncia, limpeza)
--   auto_expired  — importada que venceu por tempo, sem ação humana
--
-- `auto_expired` NÃO é gravado por esta migration: hoje a expiração de
-- importada é calculada em tempo de leitura (`isPublicTable`), não persistida.
-- A coluna existe para quando houver rotina que materialize isso; até lá, a
-- tela deriva esse caso do `origin='imported'` + data calculada.
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS closed_reason TEXT;

-- `ADD CONSTRAINT` não aceita `IF NOT EXISTS` no PostgreSQL 16 — envolver em DO
-- checando `pg_constraint` é o padrão exigido para idempotência
-- (AGENTS.md §Migrations item 2).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tables_closed_reason_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_closed_reason_check
      CHECK (closed_reason IS NULL OR closed_reason IN ('gm', 'admin', 'auto_expired'));
  END IF;
END $$;

-- Índice parcial: a tela de mesa encerrada consulta só linhas arquivadas, que
-- são minoria. Índice cheio pagaria escrita em todo INSERT de mesa ativa para
-- servir uma leitura que nunca olha essas linhas.
CREATE INDEX IF NOT EXISTS idx_tables_archived_by
  ON tables (archived_by)
  WHERE archived_by IS NOT NULL;

COMMENT ON COLUMN tables.archived_by IS
  'Usuário que encerrou/arquivou a mesa. NULL em mesas encerradas antes de 2026-08-11 (dado nunca gravado) e em expiração automática de importada.';

COMMENT ON COLUMN tables.closed_reason IS
  'Motivo do encerramento: gm | admin | auto_expired. NULL em mesas encerradas antes de 2026-08-11.';
