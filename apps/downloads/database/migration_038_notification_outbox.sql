-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-08-12
-- @description: Outbox local de notificacao do downloads: evento enfileirado na transacao de moderacao e entregue fora dela ao par consolidado do accounts, encerrando o rollback de moderacao por falha de notificacao

-- T3.5 / T3.13 (spec 090, requisitos 13c-i e 13a-i). Idempotente. online-safe:
-- so CREATE TABLE/INDEX, sem DROP/TRUNCATE/DELETE.
--
-- ## O defeito que isto corrige, medido
--
-- Quatro das cinco emissoes do downloads rodam DENTRO de `db.transaction()`
-- passando `trx` (`moderation.ts:152`, `:227`, `:354`, `reports.ts:308`).
-- Falha do INSERT de notificacao faz rollback da rejeicao, da aprovacao e da
-- decisao de denuncia — o moderador ve a acao nao concluida por causa de um
-- aviso. A quinta (`systemSuggestionsAdmin.ts:346`) e o oposto por decisao
-- documentada em `:339-341`: pos-commit, sem await, com `.catch()` que engole,
-- entao um aviso perdido some sem registro.
--
-- ## Por que outbox local e nao chamada HTTP direta
--
-- A spec (13a-i, spec.md:244) manda o downloads virar PRODUTOR do par
-- consolidado do accounts, parando de gravar em `download_notification`. Mas
-- chamada HTTP para `accounts.` dentro da transacao de moderacao trocaria um
-- defeito por outro pior: a transacao ficaria aberta durante a rede, e um
-- accounts lento seguraria lock de `download_material`. Fora da transacao,
-- perderia o evento em queda de processo entre commit e envio.
--
-- Outbox resolve os dois, e e o MESMO desenho que 13c-i ja fixou para o lado do
-- accounts (`notification_outbox`, migration_010 secao 5): a linha entra na
-- transacao da acao de merito — nao se perde —, o envio roda fora dela — nao
-- derruba a moderacao. A diferenca e so o consumidor: la o fan-out cria recibo
-- local, aqui o sweep faz POST /internal/v1/notifications/events.
--
-- `download_notification` NAO e removida aqui: 13a-i preve que ela fique
-- read-only enquanto o historico nao migra (T3.16), e a tela legada continua
-- lendo dela ate a conversao de leitura. Esta migration so cria o caminho novo.

CREATE TABLE IF NOT EXISTS download_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotencia do produtor (`spec.md` 13c). Gerado aqui, enviado no corpo e
  -- reusado em retry: o UNIQUE `(realm, source_app, event_id)` do accounts
  -- (migration_006:471) transforma reenvio em no-op em vez de aviso duplicado.
  event_id UUID NOT NULL UNIQUE,

  -- Espelha os cinco `kind` que o downloads ja emite (`services/notify.ts:12`),
  -- prefixados pelo modulo para nao colidir com `comment.*`/`moderation.*` do
  -- registro central.
  event_type TEXT NOT NULL CHECK (LENGTH(event_type) BETWEEN 1 AND 64),
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version > 0),

  subject_type TEXT NOT NULL CHECK (LENGTH(subject_type) BETWEEN 1 AND 64),
  subject_id TEXT NOT NULL CHECK (LENGTH(subject_id) BETWEEN 1 AND 255),

  -- Mesmo CHECK do consolidado (migration_006:480-486), aplicado na origem:
  -- path invalido rejeitado aqui vira erro visivel no teste do downloads, em
  -- vez de 400 silencioso no sweep depois de a moderacao ja ter commitado.
  canonical_path TEXT NOT NULL CHECK (
    LENGTH(canonical_path) BETWEEN 1 AND 1024
    AND canonical_path LIKE '/%'
    AND canonical_path NOT LIKE '//%'
    AND POSITION(CHR(92) IN canonical_path) = 0
    AND POSITION('://' IN canonical_path) = 0
  ),

  -- Estruturado, nunca mensagem pronta (`spec.md` 13b). O corpo legado dos
  -- cinco `kind` viaja aqui como campo do snapshot (24e, spec.md:320: "corpo
  -- congelado como legado"), sem virar `kind` oficial do registro central.
  snapshot JSONB NOT NULL CHECK (JSONB_TYPEOF(snapshot) = 'object'),

  -- Destinatarios resolvidos na transacao: o accounts nao sabe quem e dono de
  -- um material (`plan.md:115-116`), quem chama informa.
  recipients JSONB NOT NULL CHECK (JSONB_TYPEOF(recipients) = 'array'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,

  -- Diagnostico de entrega. Sem isto, aviso que nunca chegou fica
  -- indistinguivel de aviso que nunca foi emitido — exatamente o defeito do
  -- `.catch()` que engole em `systemSuggestionsAdmin.ts:346`.
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT
);

-- Parcial em `delivered_at IS NULL`: o sweep so varre pendencia, e o indice nao
-- cresce com o historico entregue.
CREATE INDEX IF NOT EXISTS idx_download_notification_outbox_pending
  ON download_notification_outbox (created_at)
  WHERE delivered_at IS NULL;

DO $$
BEGIN
  RAISE NOTICE 'migration_038: download_notification_outbox ok';
END
$$;
