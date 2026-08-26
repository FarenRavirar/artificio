-- @class: online-safe
-- @requires-backup: false
-- @author: spec-096
-- @created: 2026-08-26
-- @description: Adiciona notification_event.read_at para que migracao de historico legado crie recibo ja lido, em vez de reapresentar como pendente aviso que o usuario ja tinha despachado

-- Achado de review (PR #289, Codex P2).
--
-- ## O problema
--
-- A spec 096 (fase 7) removeu as rotas `/api/v1/notifications` do `mesas`, e o
-- `NotificationBell` de `packages/ui` passou a ler exclusivamente do par
-- consolidado daqui. Medido no `mesas` em producao (2026-08-26): 70 avisos, dos
-- quais 4 JA LIDOS. Sem caminho de leitura no `mesas` e sem migracao, esses 4
-- somem do historico do usuario.
--
-- Migra-los sem preservar o estado de leitura seria pior que perde-los: o
-- fan-out grava `read_at: null` fixo (`notificationOutbox.ts:136`), entao os 4
-- reapareceriam como NAO LIDOS, inflando o contador do sino de quem ja os tinha
-- despachado semanas atras.
--
-- ## Por que no evento, e nao no outbox
--
-- `processOutboxEntry` ja le a linha do evento para aplicar o filtro de
-- preferencia (`notificationOutbox.ts:58-64`). Carregar o campo ali dispensa
-- coluna nova em `notification_outbox` e qualquer mudanca em
-- `enqueueOutboxEvent` — o fan-out ja tem o dado em maos quando cria o recibo.
--
-- ## Escopo de uso
--
-- Campo de MIGRACAO, nao de fluxo corrente: evento novo nasce nao lido por
-- definicao. Anulavel e sem default, entao produtor que nao manda nada
-- (o `downloads`, hoje) continua identico — o fan-out le NULL e grava
-- `read_at: null`, exatamente como antes.
--
-- A listagem ja devolve recibo lido (`notificationData.ts:170-187` seleciona
-- `read_at` sem filtrar; so `/unread-count` filtra `read_at IS NULL`), entao o
-- aviso migrado aparece no historico sem contar como pendente.

ALTER TABLE notification_event
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

COMMENT ON COLUMN notification_event.read_at IS
  'Somente migracao de historico legado: quando preenchido, o fan-out cria o recibo ja lido em vez de pendente. NULL (o padrao) mantem o comportamento normal de aviso novo.';

DO $$
BEGIN
  RAISE NOTICE 'migration_012: notification_event.read_at ok';
END
$$;
