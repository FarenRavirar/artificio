-- @class: online-safe
-- @requires-backup: false
-- @author: spec-096
-- @created: 2026-08-26
-- @description: Adiciona next_attempt_at e transient_count ao outbox de notificacao do downloads para que falha transitoria do accounts adie a entrega em backoff sem consumir o teto de tentativas e sem abandonar aviso valido

-- Achado de review (PR #289, Codex P1), corrigido nos dois produtores de outbox
-- ao mesmo tempo: `mesas` recebe o campo na propria migration_163 (ainda nao
-- aplicada) e `download_notification_outbox` recebe aqui, porque a
-- migration_038 ja esta em producao desde 2026-08-15.
--
-- ## O defeito
--
-- `claimPending` filtra `attempt_count < 5`, e o worker incrementava
-- `attempt_count` igual em TODA falha — inclusive 5xx, 429, 401/403 e timeout
-- de rede, que os proprios comentarios do codigo classificam como transitorios.
-- Consequencia medida no desenho: com o sweep a cada 5 min, uma indisponibilidade
-- de ~25 min do `accounts.` (ou cinco disparos pos-commit numa rajada) levava
-- `attempt_count` a 5 e o aviso saia da fila PARA SEMPRE, mesmo depois de tudo
-- voltar ao normal. Perda silenciosa causada por uma janela ja encerrada — o
-- mesmo defeito que a PR #257 corrigiu para a CLASSIFICACAO do erro e que
-- sobreviveu na CONTAGEM.
--
-- ## A correcao
--
-- DOIS contadores, porque sao duas medidas diferentes:
--
-- - `attempt_count` conta culpa da MENSAGEM (400/422) e continua sendo o unico
--   criterio de descarte do claim. So o caminho permanente escreve nele, e
--   escreve o teto de uma vez.
-- - `transient_count` (novo) conta culpa do AMBIENTE e alimenta so o backoff
--   (`backoffDelayMs`: 1, 2, 4, 8, 16, 32, 60 min, com teto). O claim NAO filtra
--   por ele, entao cresce sem limite e a entrada nunca sai da fila por
--   indisponibilidade — so volta cada vez mais devagar.
--
-- Um contador so nao resolve, e a primeira tentativa de correcao provou isso:
-- acrescentar `next_attempt_at` mantendo o incremento de `attempt_count` apenas
-- ADIOU o abandono para a quinta falha transitoria, porque o filtro
-- `attempt_count < 5` continuava valendo (achado P1, segunda rodada de review).
--
-- O preco de `transient_count` crescer sem limite e uma entrada que tenta para
-- sempre contra um accounts permanentemente quebrado. E o preco certo: aviso
-- preso na fila com `last_error` legivel e operavel, aviso descartado em
-- silencio e perda de dado que ninguem descobre.
--
-- Idempotente: `ADD COLUMN IF NOT EXISTS` + recriacao do indice parcial.
-- Compativel com codigo antigo: coluna anulavel, e `NULL` significa "elegivel
-- agora", entao um worker da versao anterior (que nao escreve nem le o campo)
-- continua funcionando durante o deploy escalonado.

ALTER TABLE download_notification_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

-- NOT NULL com DEFAULT e seguro em online-safe no PG 16: desde o PG 11 a coluna
-- nova com default nao reescreve a tabela (o default fica no catalogo).
ALTER TABLE download_notification_outbox
  ADD COLUMN IF NOT EXISTS transient_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'download_notification_outbox_transient_count_check'
  ) THEN
    ALTER TABLE download_notification_outbox
      ADD CONSTRAINT download_notification_outbox_transient_count_check
      CHECK (transient_count >= 0);
  END IF;
END
$$;

COMMENT ON COLUMN download_notification_outbox.next_attempt_at IS
  'Momento a partir do qual a entrada volta a ser elegivel ao sweep. NULL = elegivel agora (nunca falhou, ou defeito permanente ja fora da fila pelo attempt_count).';

COMMENT ON COLUMN download_notification_outbox.transient_count IS
  'Falhas de ambiente acumuladas (5xx, 429, 401/403, 404, 408, rede). Alimenta so o backoff; o claim nao filtra por ele, entao indisponibilidade longa atrasa a entrega sem nunca descartar o aviso.';

-- O indice parcial precisa cobrir o novo predicado do claim
-- (`next_attempt_at IS NULL OR next_attempt_at <= now()`), senao a consulta
-- filtra fora do indice e o planner volta ao seq scan conforme a fila cresce.
-- `NULLS FIRST` porque NULL e o caso elegivel, nao o adiado.
DROP INDEX IF EXISTS idx_download_notification_outbox_pending;

CREATE INDEX IF NOT EXISTS idx_download_notification_outbox_pending
  ON download_notification_outbox (next_attempt_at NULLS FIRST, created_at)
  WHERE delivered_at IS NULL AND attempt_count < 5;

DO $$
BEGIN
  RAISE NOTICE 'migration_039: download_notification_outbox.next_attempt_at + transient_count ok';
END
$$;
