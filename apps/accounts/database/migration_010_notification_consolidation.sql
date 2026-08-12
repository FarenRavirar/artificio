-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-08-11
-- @description: Consolida notificacoes: amplia CHECK source_app para aceitar todos os modulos e accounts, indice de cursor por (realm, source_app, occurred_at, id), coluna metadata JSONB em notification_event, tabela notification_preference por usuario e event_type sem realm

-- T3.14. Idempotente (roda 2x sem erro). online-safe: sem DROP TABLE/COLUMN,
-- sem TRUNCATE, sem DELETE FROM. DROP CONSTRAINT IF EXISTS e permitido em
-- online-safe (AGENTS.md §Migrations §2).
--
-- Requisitos:
-- - 13a-ii (spec.md:245): source_app aceita todos os modulos e accounts.
--   CHECK atual (migration_006:473,506) so admite downloads|site|mesas.
-- - 19b (spec.md:282): indice por (realm, source_app, occurred_at, id) do
--   evento sustenta paginacao por cursor de T3.6. O parcial existente
--   (migration_006:517-525) ordena por created_at do recibo — diverge quando
--   entrar evento externo com occurred_at retroativo via outbox.
-- - metadata JSONB absorvido do mesas (migration_106:13), mesmo padrao do
--   snapshot (migration_006:487): nullable, CHECK JSONB_TYPEOF = 'object'
--   quando nao nulo.
-- - 20a-ii (spec.md:288): preferencia unica por (user_id, event_type), sem
--   realm — acompanha a identidade e vale nos dois ambientes. Linha ausente
--   = tudo ligado: sem backfill, conta nova e existente entram com tudo.

-- ============================================================================
-- 1. Ampliar CHECK de source_app nas duas tabelas
-- ============================================================================

-- notification_event
DO $$
DECLARE
  old_constraint_name TEXT;
BEGIN
  -- Localiza o CHECK antigo (source_app IN ('downloads','site','mesas')).
  -- migration_006 declarou CHECK inline, sem nome — Postgres gerou nome
  -- automatico. Busca por definicao evita chute de nome.
  SELECT con.conname INTO old_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'notification_event'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%source_app%'
    AND pg_get_constraintdef(con.oid) LIKE '%downloads%'
    AND pg_get_constraintdef(con.oid) NOT LIKE '%accounts%';

  IF old_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE notification_event DROP CONSTRAINT IF EXISTS ' || old_constraint_name;
  END IF;

  -- Adiciona o novo CHECK se ainda nao existir (idempotencia: 2a execucao
  -- encontra o CHECK ja criado e nao faz nada).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'notification_event'
      AND con.contype = 'c'
      AND con.conname = 'notification_event_source_app_consolidated_check'
  ) THEN
    ALTER TABLE notification_event ADD CONSTRAINT notification_event_source_app_consolidated_check
      CHECK (source_app IN ('downloads', 'site', 'mesas', 'glossario', 'links', 'accounts'));
  END IF;
END $$;

-- notification_receipt — mesmo padrao
DO $$
DECLARE
  old_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO old_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'notification_receipt'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%source_app%'
    AND pg_get_constraintdef(con.oid) LIKE '%downloads%'
    AND pg_get_constraintdef(con.oid) NOT LIKE '%accounts%';

  IF old_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE notification_receipt DROP CONSTRAINT IF EXISTS ' || old_constraint_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'notification_receipt'
      AND con.contype = 'c'
      AND con.conname = 'notification_receipt_source_app_consolidated_check'
  ) THEN
    ALTER TABLE notification_receipt ADD CONSTRAINT notification_receipt_source_app_consolidated_check
      CHECK (source_app IN ('downloads', 'site', 'mesas', 'glossario', 'links', 'accounts'));
  END IF;
END $$;

-- ============================================================================
-- 2. Indice para cursor de paginacao (requisito 19b)
-- ============================================================================

-- Sustenta SELECT ... WHERE realm = $1 AND source_app = $2
-- ORDER BY occurred_at, id para paginacao por cursor (T3.6).
-- O indice parcial existente (idx_notification_receipt_user_unread) cobre
-- contagem de nao lidas e continua ativo — este e adicional.
--
-- CREATE INDEX (nao CONCURRENTLY) toma lock SHARE: permite leitura, pausa
-- escrita em notification_event durante a construcao. O deploy runner
-- envolve a migration em BEGIN, entao CONCURRENTLY nao roda aqui. Pausa
-- aceita para online-safe: tabela pequena neste ponto do rollout.
CREATE INDEX IF NOT EXISTS idx_notification_event_cursor
  ON notification_event(realm, source_app, occurred_at, id);

-- ============================================================================
-- 3. Coluna metadata JSONB em notification_event (absorvida do mesas)
-- ============================================================================

-- Mesmo padrao de snapshot (migration_006:487): nullable, CHECK de tipo
-- quando nao nulo. Dado estruturado que o produtor grava junto do evento
-- (ex.: duracao de suspensao, motivo de denuncia); formata T3.3 consome.
ALTER TABLE notification_event ADD COLUMN IF NOT EXISTS metadata JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'notification_event'
      AND con.conname = 'notification_event_metadata_check'
  ) THEN
    ALTER TABLE notification_event ADD CONSTRAINT notification_event_metadata_check
      CHECK (metadata IS NULL OR JSONB_TYPEOF(metadata) = 'object');
  END IF;
END $$;

-- ============================================================================
-- 4. Tabela de preferencia de notificacao (T3.11b, requisito 20a-ii)
-- ============================================================================

-- Sem realm: acompanha a identidade, vale nos dois ambientes.
-- Linha ausente = tudo ligado (default enabled = true na aplicacao,
-- nao no banco — nao ha linha para cada event_type, conta nova entra
-- sem linha nenhuma e a leitura trata ausencia como enabled).
CREATE TABLE IF NOT EXISTS notification_preference (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (LENGTH(event_type) BETWEEN 1 AND 100),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_type)
);

-- ============================================================================
-- 5. Outbox de entrega de notificacao (T3.15, requisito 13c-i)
-- ============================================================================

-- Evento entra na transacao da acao de merito; o fan-out roda fora dela.
-- processed_at IS NULL = pendente. Reprocessar o mesmo event_id e idempotente:
-- o consumidor usa INSERT ... ON CONFLICT (event_id, user_id) DO NOTHING no
-- recibo, entao reprocessar nao duplica.
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (
    source_app IN ('downloads', 'site', 'mesas', 'glossario', 'links', 'accounts')
  ),
  event_id UUID NOT NULL UNIQUE,
  recipients JSONB NOT NULL CHECK (JSONB_TYPEOF(recipients) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Sustenta o scan de pendencias do fan-out (processOutboxPending):
-- WHERE processed_at IS NULL ORDER BY created_at ASC.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON notification_outbox(created_at)
  WHERE processed_at IS NULL;
