-- @class: online-safe
-- @requires-backup: false
-- @author: spec-096
-- @created: 2026-08-26
-- @description: Adiciona next_attempt_at ao outbox de notificacao do downloads para que falha transitoria do accounts adie a entrega em backoff em vez de consumir o teto de tentativas e abandonar aviso valido

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
-- `attempt_count` deixa de ser criterio de descarte para falha de ambiente e
-- passa a decidir so o intervalo (`backoffDelayMs`: 1, 2, 4, 8, 16, 32, 60 min,
-- com teto). Quem descarta continua sendo `attempt_count >= 5`, mas so alcanca
-- esse valor quem tem defeito comprovado de payload (400/422), que o worker
-- grava de uma vez.
--
-- Idempotente: `ADD COLUMN IF NOT EXISTS` + recriacao do indice parcial.
-- Compativel com codigo antigo: coluna anulavel, e `NULL` significa "elegivel
-- agora", entao um worker da versao anterior (que nao escreve nem le o campo)
-- continua funcionando durante o deploy escalonado.

ALTER TABLE download_notification_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

COMMENT ON COLUMN download_notification_outbox.next_attempt_at IS
  'Momento a partir do qual a entrada volta a ser elegivel ao sweep. NULL = elegivel agora (nunca falhou, ou defeito permanente ja fora da fila pelo attempt_count).';

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
  RAISE NOTICE 'migration_039: download_notification_outbox.next_attempt_at ok';
END
$$;
