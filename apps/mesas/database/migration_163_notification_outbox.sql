-- @class: online-safe
-- @requires-backup: false
-- @author: spec-096
-- @created: 2026-08-25
-- @description: Outbox local de notificacao do mesas: evento enfileirado na transacao da acao de merito e entregue fora dela ao par consolidado do accounts, encerrando o rollback de aprovacao de sugestao por falha de notificacao

-- T7.4b (spec 096, requisitos 13a-i/13c-i da spec 090). Idempotente.
-- online-safe: so CREATE TABLE/INDEX, sem DROP/TRUNCATE/DELETE.
--
-- ## O defeito que isto corrige, medido no mesas
--
-- Sao 12 pontos de INSERT em `notifications`, em 6 arquivos, e eles falham de
-- duas formas opostas:
--
-- 1. SETE rodam DENTRO de `db.transaction()` passando `trx`
--    (`systemSuggestionsAdmin.ts:391`, `:519`, `:580`, `:671`, `:796`, `:898`,
--    `:1005`). Falha do INSERT de notificacao faz ROLLBACK da aprovacao da
--    sugestao: o admin ve a acao nao concluida por causa de um aviso.
-- 2. O resto e o oposto — `notifyAdmins` (`adminNotifications.ts:50-52`) tem
--    `catch` que ENGOLE o erro, entao um aviso perdido some sem registro. O
--    proprio comentario da funcao (`:24`) ja avisava "nao use dentro de
--    transacao", o que confirma que as duas formas convivem de proposito, sem
--    que nenhuma delas seja segura.
--
-- ## Por que outbox e nao chamada HTTP direta
--
-- O `POST /internal/v1/notifications/events` do accounts ja existe desde a spec
-- 090 (T3.13) e ja tem um produtor real: o `downloads` (migration_038 +
-- `notificationOutboxDelivery.ts`). Chamar esse POST de dentro da transacao de
-- aprovacao trocaria um defeito por outro pior — a transacao ficaria aberta
-- durante a rede, e um accounts lento seguraria lock de `system_suggestions`.
-- Fora da transacao, perderia o evento em queda de processo entre commit e
-- envio.
--
-- Outbox resolve os dois, e e o MESMO desenho ja validado em producao pelo
-- downloads: a linha entra na transacao da acao de merito — nao se perde —, e o
-- envio roda fora dela — nao derruba a aprovacao.
--
-- `notifications` NAO e removida aqui: o historico (70 linhas, 62 nao lidas em
-- 2026-08-25) continua sendo lido pelas rotas atuais ate o backfill terminar.
-- Esta migration so cria o caminho novo.

CREATE TABLE IF NOT EXISTS mesas_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotencia do produtor. Gerado aqui, enviado no corpo e reusado em retry:
  -- o UNIQUE `event_id` do accounts (migration_006:471) transforma reenvio em
  -- no-op em vez de aviso duplicado.
  event_id UUID NOT NULL UNIQUE,

  -- Prefixado pelo modulo para nao colidir com `comment.*`/`moderation.*` do
  -- registro central. Deriva dos tipos que o mesas ja emite hoje
  -- (`suggestion_approved`, `suggestion_rejected`, `system`) mais os do feed do
  -- admin (`AdminNotificationType`, adminNotifications.ts:4-9).
  event_type TEXT NOT NULL CHECK (LENGTH(event_type) BETWEEN 1 AND 64),
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version > 0),

  subject_type TEXT NOT NULL CHECK (LENGTH(subject_type) BETWEEN 1 AND 64),
  subject_id TEXT NOT NULL CHECK (LENGTH(subject_id) BETWEEN 1 AND 255),

  -- Mesmo CHECK do consolidado (migration_006:480-486), aplicado na origem:
  -- path invalido rejeitado aqui vira erro visivel no teste do mesas, em vez de
  -- 400 silencioso no sweep depois de a aprovacao ja ter commitado. O ingest do
  -- accounts ja registra que os paths legados do mesas sao montados por
  -- interpolacao sem validacao (`notificationIngestRoutes.ts:58-61`).
  canonical_path TEXT NOT NULL CHECK (
    LENGTH(canonical_path) BETWEEN 1 AND 1024
    AND canonical_path LIKE '/%'
    AND canonical_path NOT LIKE '//%'
    AND POSITION(CHR(92) IN canonical_path) = 0
    AND POSITION('://' IN canonical_path) = 0
  ),

  -- Estruturado, nunca mensagem pronta. `title`/`message` do formato legado
  -- viajam como campo do snapshot, sem virar vocabulario oficial do registro
  -- central.
  snapshot JSONB NOT NULL CHECK (JSONB_TYPEOF(snapshot) = 'object'),

  -- Destinatarios resolvidos na transacao: o accounts nao sabe quem e dono de
  -- uma sugestao nem quem sao os admins do mesas, entao quem chama informa.
  recipients JSONB NOT NULL CHECK (JSONB_TYPEOF(recipients) = 'array'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,

  -- Diagnostico de entrega. Sem isto, aviso que nunca chegou fica
  -- indistinguivel de aviso que nunca foi emitido — exatamente o defeito do
  -- `catch` que engole em `adminNotifications.ts:50`.
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,

  -- Lease de processamento. O sweep periodico e o disparo pos-commit rodam
  -- concorrentes por construcao, entao sem claim os dois leriam as mesmas linhas
  -- e entregariam cada aviso duas vezes. `FOR UPDATE SKIP LOCKED` nao serve
  -- porque a entrega faz HTTP no meio e manteria a transacao aberta durante a
  -- rede; o claim por UPDATE atomico reserva sem segurar transacao.
  --
  -- Com prazo, e nao booleano: worker que morre no meio da varredura nao prende
  -- a entrada para sempre — ela volta a fila quando o lease expira.
  claimed_until TIMESTAMPTZ,

  -- Agendamento da proxima tentativa (backoff exponencial: 1, 2, 4... ate 60
  -- min). NULL = elegivel agora (nunca falhou, ou falha ja reagendada).
  --
  -- Existe porque `attempt_count` sozinho confundia duas coisas: "quantas vezes
  -- tentou" e "pode tentar de novo". Como o sweep filtra `attempt_count < 5`,
  -- cinco falhas transitorias seguidas (accounts fora por ~25 min) abandonavam
  -- permanentemente aviso valido. Agora falha de ambiente ADIA; so defeito de
  -- payload (400/422) esgota o teto.
  next_attempt_at TIMESTAMPTZ
);

-- Parcial: o sweep so varre o que ainda pode ser entregue. O predicado espelha
-- exatamente o filtro do worker (`delivered_at IS NULL AND attempt_count < 5`),
-- senao o indice cobriria linhas que a consulta nunca pede e o planner voltaria
-- ao seq scan. `5` e o `MAX_ATTEMPTS` de `notificationOutboxDelivery.ts`: mudar
-- um exige mudar o outro.
CREATE INDEX IF NOT EXISTS idx_mesas_notification_outbox_pending
  ON mesas_notification_outbox (next_attempt_at NULLS FIRST, created_at)
  WHERE delivered_at IS NULL AND attempt_count < 5;

DO $$
BEGIN
  RAISE NOTICE 'migration_163: mesas_notification_outbox ok';
END
$$;
