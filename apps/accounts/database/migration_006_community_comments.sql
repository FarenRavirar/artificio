-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-08-04
-- @description: Schema comunitario de comentarios, votos, notificacoes e moderacao

-- T2.1-T2.1f nascem juntos por contrato: denuncia referencia versao,
-- ranking referencia comentario e recibo nasce na transacao da escrita. Separar
-- em migrations diferentes criaria estados intermediarios impossiveis de usar.

CREATE OR REPLACE FUNCTION comment_wilson_reddit_80_v1(
  positive_votes INTEGER,
  negative_votes INTEGER
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN positive_votes + negative_votes = 0 THEN 0::NUMERIC
    ELSE (
      (
        positive_votes::NUMERIC / (positive_votes + negative_votes)
        + 1.281551565545::NUMERIC ^ 2 / (2 * (positive_votes + negative_votes))
        - 1.281551565545::NUMERIC * SQRT(
          (
            (positive_votes::NUMERIC / (positive_votes + negative_votes))
            * (1 - positive_votes::NUMERIC / (positive_votes + negative_votes))
            + 1.281551565545::NUMERIC ^ 2 / (4 * (positive_votes + negative_votes))
          ) / (positive_votes + negative_votes)
        )
      ) / (
        1 + 1.281551565545::NUMERIC ^ 2 / (positive_votes + negative_votes)
      )
    )
  END;
$$;

CREATE TABLE IF NOT EXISTS community_actor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unica estrutura que liga ator comunitario a conta autenticavel. Apagar esta
-- linha nao apaga conversa, voto, denuncia ou auditoria.
CREATE TABLE IF NOT EXISTS community_actor_account_link (
  actor_id UUID PRIMARY KEY REFERENCES community_actor(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  retention_until TIMESTAMPTZ,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  legal_hold_reason TEXT,
  legal_hold_changed_by UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  legal_hold_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_actor_link_legal_hold_check CHECK (
    NOT legal_hold OR (
      legal_hold_reason IS NOT NULL
      AND LENGTH(BTRIM(legal_hold_reason)) > 0
      AND legal_hold_changed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_community_actor_link_retention
  ON community_actor_account_link(retention_until)
  WHERE retention_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS community_actor_link_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES community_actor(id),
  action TEXT NOT NULL CHECK (action IN (
    'linked',
    'retention_set',
    'legal_hold_set',
    'legal_hold_released',
    'unlinked'
  )),
  -- NO ACTION, nunca SET NULL: esta tabela e append-only por trigger, entao um
  -- SET NULL disparado por DELETE de ator falharia com "append-only" no meio da
  -- cascata (achado de review da PR #241, reproduzido em Postgres real). O
  -- expurgo do requisito 7b desfaz o VINCULO ator->conta
  -- (community_actor_account_link), nao o `community_actor` opaco, que persiste
  -- para manter comentario e voto. Deletar ator com auditoria e erro de uso e
  -- deve falhar cedo e explicito, nao ser mascarado como anonimizacao.
  performed_by_actor_id UUID REFERENCES community_actor(id),
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason)) > 0),
  retention_until TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HMAC-SHA-256 do identificador Google. Nunca guarda identificador, email ou IP.
CREATE TABLE IF NOT EXISTS community_identity_block (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES community_actor(id),
  fingerprint BYTEA NOT NULL CHECK (OCTET_LENGTH(fingerprint) = 32),
  purpose TEXT NOT NULL CHECK (purpose IN ('voluntary_deletion', 'sanction')),
  key_version INTEGER NOT NULL CHECK (key_version > 0),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_identity_block_expiry_check CHECK (
    purpose = 'sanction' OR expires_at IS NOT NULL
  ),
  UNIQUE (fingerprint, purpose, key_version)
);

CREATE INDEX IF NOT EXISTS idx_community_identity_block_expiry
  ON community_identity_block(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS community_comment_subject (
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  subject_type TEXT NOT NULL CHECK (
    LENGTH(subject_type) BETWEEN 1 AND 64
    AND subject_type LIKE '%.%'
  ),
  subject_id TEXT NOT NULL CHECK (LENGTH(subject_id) BETWEEN 1 AND 255),
  canonical_path TEXT NOT NULL CHECK (
    LENGTH(canonical_path) BETWEEN 1 AND 1024
    AND canonical_path LIKE '/%'
    AND canonical_path NOT LIKE '//%'
    AND POSITION(CHR(92) IN canonical_path) = 0
    AND POSITION('://' IN canonical_path) = 0
  ),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ranking_revision BIGINT NOT NULL DEFAULT 0 CHECK (ranking_revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (realm, source_app, subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS community_comment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  subject_type TEXT NOT NULL CHECK (LENGTH(subject_type) BETWEEN 1 AND 64),
  subject_id TEXT NOT NULL CHECK (LENGTH(subject_id) BETWEEN 1 AND 255),
  community_actor_id UUID REFERENCES community_actor(id),
  parent_id UUID,
  root_id UUID NOT NULL,
  depth SMALLINT NOT NULL CHECK (depth BETWEEN 0 AND 4),
  body_markdown TEXT,
  legacy_content_html TEXT,
  legacy_sanitizer_policy TEXT,
  legacy_sanitizer_version INTEGER,
  current_version_id UUID NOT NULL,
  created_revision BIGINT NOT NULL CHECK (created_revision >= 0),
  visibility_state TEXT NOT NULL DEFAULT 'visible' CHECK (visibility_state IN (
    'visible',
    'author_removed',
    'moderator_removed',
    'pending_review_hidden'
  )),
  edited_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  removed_reason TEXT CHECK (removed_reason IS NULL OR LENGTH(removed_reason) <= 500),
  legacy_source TEXT,
  legacy_id TEXT,
  legacy_author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_comment_subject_fk FOREIGN KEY (
    realm,
    source_app,
    subject_type,
    subject_id
  ) REFERENCES community_comment_subject (
    realm,
    source_app,
    subject_type,
    subject_id
  ),
  CONSTRAINT community_comment_root_shape_check CHECK (
    (depth = 0 AND parent_id IS NULL AND root_id = id)
    OR (depth > 0 AND parent_id IS NOT NULL)
  ),
  CONSTRAINT community_comment_body_kind_check CHECK (
    (
      legacy_source IS NULL
      AND legacy_id IS NULL
      AND legacy_author_name IS NULL
      AND legacy_content_html IS NULL
      AND legacy_sanitizer_policy IS NULL
      AND legacy_sanitizer_version IS NULL
      AND community_actor_id IS NOT NULL
      AND body_markdown IS NOT NULL
      AND LENGTH(body_markdown) BETWEEN 1 AND 10000
    ) OR (
      legacy_source IS NOT NULL
      AND legacy_id IS NOT NULL
      AND legacy_author_name IS NOT NULL
      AND legacy_content_html IS NOT NULL
      AND legacy_sanitizer_policy IS NOT NULL
      AND legacy_sanitizer_version IS NOT NULL
      AND legacy_sanitizer_version > 0
      AND community_actor_id IS NULL
      AND body_markdown IS NULL
    )
  ),
  CONSTRAINT community_comment_removal_check CHECK (
    (
      visibility_state IN ('visible', 'pending_review_hidden')
      AND removed_at IS NULL
      AND removed_by_actor_id IS NULL
      AND removed_reason IS NULL
    ) OR (
      visibility_state = 'author_removed'
      AND removed_at IS NOT NULL
      AND community_actor_id IS NOT NULL
      AND removed_by_actor_id IS NOT NULL
      AND removed_by_actor_id = community_actor_id
      AND removed_reason IS NOT NULL
      AND LENGTH(BTRIM(removed_reason)) > 0
    ) OR (
      visibility_state = 'moderator_removed'
      AND removed_at IS NOT NULL
      AND removed_by_actor_id IS NOT NULL
      AND removed_reason IS NOT NULL
      AND LENGTH(BTRIM(removed_reason)) > 0
    )
  ),
  UNIQUE (realm, source_app, id),
  UNIQUE (realm, source_app, subject_type, subject_id, id)
);

CREATE INDEX IF NOT EXISTS idx_community_comment_subject_created
  ON community_comment(
    realm,
    source_app,
    subject_type,
    subject_id,
    created_at,
    id
  );

CREATE INDEX IF NOT EXISTS idx_community_comment_parent
  ON community_comment(parent_id, created_at, id)
  WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_comment_legacy
  ON community_comment(legacy_source, legacy_id)
  WHERE legacy_source IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.community_comment'::regclass
      AND conname = 'community_comment_parent_subject_fk'
  ) THEN
    ALTER TABLE community_comment
      ADD CONSTRAINT community_comment_parent_subject_fk
      FOREIGN KEY (realm, source_app, subject_type, subject_id, parent_id)
      REFERENCES community_comment(realm, source_app, subject_type, subject_id, id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.community_comment'::regclass
      AND conname = 'community_comment_root_subject_fk'
  ) THEN
    ALTER TABLE community_comment
      ADD CONSTRAINT community_comment_root_subject_fk
      FOREIGN KEY (realm, source_app, subject_type, subject_id, root_id)
      REFERENCES community_comment(realm, source_app, subject_type, subject_id, id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_comment_version (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  comment_id UUID NOT NULL,
  authored_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  body_markdown TEXT,
  legacy_content_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redacted_at TIMESTAMPTZ,
  redacted_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  redaction_reason TEXT,
  CONSTRAINT community_comment_version_body_check CHECK (
    (
      redacted_at IS NULL
      AND (
        (body_markdown IS NOT NULL AND legacy_content_html IS NULL
          AND LENGTH(body_markdown) BETWEEN 1 AND 10000)
        OR (body_markdown IS NULL AND legacy_content_html IS NOT NULL)
      )
    ) OR (
      redacted_at IS NOT NULL
      AND body_markdown IS NULL
      AND legacy_content_html IS NULL
      AND redacted_by_actor_id IS NOT NULL
      AND redaction_reason IS NOT NULL
      AND LENGTH(BTRIM(redaction_reason)) > 0
    )
  ),
  CONSTRAINT community_comment_version_comment_fk
    FOREIGN KEY (realm, source_app, comment_id)
    REFERENCES community_comment(realm, source_app, id),
  UNIQUE (realm, source_app, id),
  UNIQUE (realm, source_app, id, comment_id),
  UNIQUE (id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_community_comment_version_comment_created
  ON community_comment_version(realm, source_app, comment_id, created_at, id);

CREATE OR REPLACE FUNCTION guard_community_comment_version_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.comment_id IS DISTINCT FROM NEW.comment_id
    OR OLD.realm IS DISTINCT FROM NEW.realm
    OR OLD.source_app IS DISTINCT FROM NEW.source_app
    OR OLD.authored_by_actor_id IS DISTINCT FROM NEW.authored_by_actor_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'identidade da versao de comentario e imutavel';
  END IF;

  IF OLD.redacted_at IS NOT NULL THEN
    RAISE EXCEPTION 'versao de comentario expurgada e imutavel';
  END IF;

  IF NEW.redacted_at IS NULL AND (
    OLD.body_markdown IS DISTINCT FROM NEW.body_markdown
    OR OLD.legacy_content_html IS DISTINCT FROM NEW.legacy_content_html
    OR NEW.redacted_by_actor_id IS NOT NULL
    OR NEW.redaction_reason IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'edicao cria nova versao; nao reescreve versao existente';
  END IF;

  IF NEW.redacted_at IS NOT NULL AND (
    NEW.body_markdown IS NOT NULL
    OR NEW.legacy_content_html IS NOT NULL
    OR NEW.redacted_by_actor_id IS NULL
    OR NEW.redaction_reason IS NULL
    OR LENGTH(BTRIM(NEW.redaction_reason)) = 0
  ) THEN
    RAISE EXCEPTION 'expurgo de versao exige ator, motivo e remocao do corpo';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.community_comment_version'::regclass
      AND tgname = 'community_comment_version_guard_update'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER community_comment_version_guard_update
      BEFORE UPDATE ON community_comment_version
      FOR EACH ROW
      EXECUTE FUNCTION guard_community_comment_version_update();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.community_comment'::regclass
      AND conname = 'community_comment_current_version_fk'
  ) THEN
    ALTER TABLE community_comment
      ADD CONSTRAINT community_comment_current_version_fk
      FOREIGN KEY (current_version_id, id)
      REFERENCES community_comment_version(id, comment_id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_comment_vote (
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  community_actor_id UUID NOT NULL REFERENCES community_actor(id),
  comment_id UUID NOT NULL,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_comment_vote_comment_fk
    FOREIGN KEY (realm, source_app, comment_id)
    REFERENCES community_comment(realm, source_app, id),
  PRIMARY KEY (realm, source_app, community_actor_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_community_comment_vote_comment
  ON community_comment_vote(realm, source_app, comment_id, community_actor_id);

CREATE TABLE IF NOT EXISTS community_comment_vote_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  community_actor_id UUID NOT NULL REFERENCES community_actor(id),
  comment_id UUID NOT NULL,
  old_value SMALLINT CHECK (old_value IN (-1, 1)),
  new_value SMALLINT CHECK (new_value IN (-1, 1)),
  reason TEXT NOT NULL DEFAULT 'user_vote',
  -- NO ACTION: tabela append-only, mesmo motivo de community_actor_link_audit.
  invalidated_by_actor_id UUID REFERENCES community_actor(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_comment_vote_audit_change_check CHECK (
    old_value IS DISTINCT FROM new_value
    AND (old_value IS NOT NULL OR new_value IS NOT NULL)
  ),
  CONSTRAINT community_comment_vote_audit_comment_fk
    FOREIGN KEY (realm, source_app, comment_id)
    REFERENCES community_comment(realm, source_app, id)
);

CREATE INDEX IF NOT EXISTS idx_community_comment_vote_audit_actor
  ON community_comment_vote_audit(
    realm,
    source_app,
    community_actor_id,
    occurred_at,
    id
  );

CREATE TABLE IF NOT EXISTS community_comment_score_version (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  comment_id UUID NOT NULL,
  valid_from_revision BIGINT NOT NULL CHECK (valid_from_revision >= 0),
  valid_to_revision BIGINT CHECK (
    valid_to_revision IS NULL OR valid_to_revision > valid_from_revision
  ),
  upvotes INTEGER NOT NULL CHECK (upvotes >= 0),
  downvotes INTEGER NOT NULL CHECK (downvotes >= 0),
  score INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
  best_score NUMERIC GENERATED ALWAYS AS (
    comment_wilson_reddit_80_v1(upvotes, downvotes)
  ) STORED,
  algorithm_version TEXT NOT NULL DEFAULT 'reddit-wilson-80-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_comment_score_comment_fk
    FOREIGN KEY (realm, source_app, comment_id)
    REFERENCES community_comment(realm, source_app, id),
  UNIQUE (realm, source_app, comment_id, valid_from_revision)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_comment_score_current
  ON community_comment_score_version(realm, source_app, comment_id)
  WHERE valid_to_revision IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_comment_score_snapshot
  ON community_comment_score_version(
    realm,
    source_app,
    comment_id,
    valid_from_revision,
    valid_to_revision
  );

CREATE TABLE IF NOT EXISTS notification_event (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL UNIQUE,
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  event_type TEXT NOT NULL CHECK (LENGTH(event_type) BETWEEN 1 AND 100),
  event_version INTEGER NOT NULL CHECK (event_version > 0),
  subject_type TEXT NOT NULL CHECK (LENGTH(subject_type) BETWEEN 1 AND 64),
  subject_id TEXT NOT NULL CHECK (LENGTH(subject_id) BETWEEN 1 AND 255),
  -- NO ACTION: tabela append-only, mesmo motivo de community_actor_link_audit.
  actor_id UUID REFERENCES community_actor(id),
  canonical_path TEXT NOT NULL CHECK (
    LENGTH(canonical_path) BETWEEN 1 AND 1024
    AND canonical_path LIKE '/%'
    AND canonical_path NOT LIKE '//%'
    AND POSITION(CHR(92) IN canonical_path) = 0
    AND POSITION('://' IN canonical_path) = 0
  ),
  snapshot JSONB NOT NULL CHECK (JSONB_TYPEOF(snapshot) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (realm, source_app, id)
);

CREATE INDEX IF NOT EXISTS idx_notification_event_subject
  ON notification_event(
    realm,
    source_app,
    subject_type,
    subject_id,
    occurred_at,
    id
  );

CREATE TABLE IF NOT EXISTS notification_receipt (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  event_id UUID NOT NULL,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_receipt_event_fk
    FOREIGN KEY (realm, source_app, event_id)
    REFERENCES notification_event(realm, source_app, id) ON DELETE CASCADE,
  UNIQUE (realm, source_app, event_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_receipt_user_unread
  ON notification_receipt(
    realm,
    source_app,
    recipient_user_id,
    created_at DESC,
    id DESC
  )
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS community_report_reason (
  target_type TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 0 AND 3),
  details_policy TEXT NOT NULL CHECK (
    details_policy IN ('required', 'optional', 'forbidden')
  ),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (target_type, code)
);

INSERT INTO community_report_reason (
  target_type,
  code,
  label,
  priority,
  details_policy
) VALUES
  ('comment', 'malicious_link', 'Link malicioso', 0, 'optional'),
  ('comment', 'inappropriate_content', 'Conteudo inapropriado', 1, 'optional'),
  ('comment', 'spam_or_off_topic', 'Spam ou fora do assunto', 2, 'optional'),
  ('comment', 'harassment_or_hate', 'Assedio ou odio', 1, 'optional'),
  ('comment', 'personal_data', 'Dados pessoais', 0, 'optional'),
  ('comment', 'copyright_violation', 'Violacao de direitos autorais', 1, 'required'),
  ('comment', 'illegal_content', 'Conteudo ilegal', 0, 'required'),
  ('comment', 'other', 'Outro', 2, 'required')
ON CONFLICT (target_type, code) DO UPDATE SET
  label = EXCLUDED.label,
  priority = EXCLUDED.priority,
  details_policy = EXCLUDED.details_policy,
  active = TRUE;

CREATE TABLE IF NOT EXISTS community_moderation_case (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  comment_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  terminal_action TEXT CHECK (
    terminal_action IN ('no_change', 'restore', 'remove')
  ),
  decision_version_id UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  decision_reason TEXT,
  CONSTRAINT community_moderation_case_terminal_check CHECK (
    (status = 'open'
      AND terminal_action IS NULL
      AND decision_version_id IS NULL
      AND closed_at IS NULL
      AND closed_by_actor_id IS NULL
      AND decision_reason IS NULL)
    OR (status = 'closed'
      AND terminal_action IS NOT NULL
      AND decision_version_id IS NOT NULL
      AND closed_at IS NOT NULL
      AND closed_by_actor_id IS NOT NULL
      AND decision_reason IS NOT NULL
      AND LENGTH(BTRIM(decision_reason)) > 0)
  ),
  CONSTRAINT community_moderation_case_version_fk
    FOREIGN KEY (realm, source_app, decision_version_id, comment_id)
    REFERENCES community_comment_version(realm, source_app, id, comment_id),
  CONSTRAINT community_moderation_case_comment_fk
    FOREIGN KEY (realm, source_app, comment_id)
    REFERENCES community_comment(realm, source_app, id),
  UNIQUE (realm, source_app, id, comment_id),
  UNIQUE (realm, source_app, id, decision_version_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_moderation_case_open
  ON community_moderation_case(realm, source_app, comment_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS community_comment_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  comment_id UUID NOT NULL,
  reported_version_id UUID NOT NULL,
  reporter_actor_id UUID NOT NULL REFERENCES community_actor(id),
  case_id UUID NOT NULL REFERENCES community_moderation_case(id),
  reason_code TEXT NOT NULL,
  reason_target_type TEXT GENERATED ALWAYS AS ('comment'::TEXT) STORED,
  details TEXT CHECK (
    details IS NULL OR (
      details = BTRIM(details)
      AND LENGTH(details) BETWEEN 1 AND 4000
    )
  ),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN (
    'active',
    'upheld',
    'dismissed',
    'no_determination',
    'withdrawn'
  )),
  resolved_at TIMESTAMPTZ,
  resolved_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  resolution_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_comment_report_version_fk
    FOREIGN KEY (realm, source_app, reported_version_id, comment_id)
    REFERENCES community_comment_version(realm, source_app, id, comment_id),
  CONSTRAINT community_comment_report_case_fk
    FOREIGN KEY (realm, source_app, case_id, comment_id)
    REFERENCES community_moderation_case(realm, source_app, id, comment_id),
  CONSTRAINT community_comment_report_reason_target_fk
    FOREIGN KEY (reason_target_type, reason_code)
    REFERENCES community_report_reason(target_type, code),
  CONSTRAINT community_comment_report_resolution_check CHECK (
    (state = 'active'
      AND resolved_at IS NULL
      AND resolved_by_actor_id IS NULL
      AND resolution_reason IS NULL)
    OR (state IN ('withdrawn', 'upheld', 'dismissed', 'no_determination')
      AND resolved_at IS NOT NULL
      AND resolved_by_actor_id IS NOT NULL
      AND resolution_reason IS NOT NULL
      AND LENGTH(BTRIM(resolution_reason)) > 0)
  )
);

CREATE OR REPLACE FUNCTION validate_community_comment_report_reason()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  required_details_policy TEXT;
BEGIN
  SELECT details_policy
  INTO required_details_policy
  FROM community_report_reason
  WHERE target_type = 'comment'
    AND code = NEW.reason_code
    AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'motivo de denuncia inexistente ou inativo';
  END IF;

  IF required_details_policy = 'required' AND NEW.details IS NULL THEN
    RAISE EXCEPTION 'motivo de denuncia exige detalhes';
  ELSIF required_details_policy = 'forbidden' AND NEW.details IS NOT NULL THEN
    RAISE EXCEPTION 'motivo de denuncia proibe detalhes';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.community_comment_report'::regclass
      AND tgname = 'community_comment_report_validate_reason'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER community_comment_report_validate_reason
      BEFORE INSERT ON community_comment_report
      FOR EACH ROW
      EXECUTE FUNCTION validate_community_comment_report_reason();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_comment_report_active
  ON community_comment_report(realm, source_app, reporter_actor_id, comment_id)
  WHERE state = 'active';

CREATE INDEX IF NOT EXISTS idx_community_comment_report_case
  ON community_comment_report(
    realm,
    source_app,
    case_id,
    state,
    created_at,
    id
  );

CREATE OR REPLACE FUNCTION guard_community_comment_report_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.comment_id IS DISTINCT FROM NEW.comment_id
    OR OLD.realm IS DISTINCT FROM NEW.realm
    OR OLD.source_app IS DISTINCT FROM NEW.source_app
    OR OLD.reported_version_id IS DISTINCT FROM NEW.reported_version_id
    OR OLD.reporter_actor_id IS DISTINCT FROM NEW.reporter_actor_id
    OR OLD.case_id IS DISTINCT FROM NEW.case_id
    OR OLD.reason_code IS DISTINCT FROM NEW.reason_code
    OR OLD.details IS DISTINCT FROM NEW.details
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'evidencia da denuncia e imutavel';
  END IF;

  IF OLD.state <> 'active' THEN
    RAISE EXCEPTION 'veredito de denuncia e imutavel';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.community_comment_report'::regclass
      AND tgname = 'community_comment_report_guard_update'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER community_comment_report_guard_update
      BEFORE UPDATE ON community_comment_report
      FOR EACH ROW
      EXECUTE FUNCTION guard_community_comment_report_update();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_comment_version_approval (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  comment_version_id UUID NOT NULL,
  approved_by_actor_id UUID NOT NULL REFERENCES community_actor(id),
  approval_reason TEXT NOT NULL CHECK (LENGTH(BTRIM(approval_reason)) > 0),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reopened_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  reopened_reason TEXT,
  reopened_at TIMESTAMPTZ,
  CONSTRAINT community_comment_version_approval_version_fk
    FOREIGN KEY (realm, source_app, comment_version_id)
    REFERENCES community_comment_version(realm, source_app, id),
  CONSTRAINT community_comment_version_approval_reopen_check CHECK (
    (reopened_at IS NULL
      AND reopened_by_actor_id IS NULL
      AND reopened_reason IS NULL)
    OR (reopened_at IS NOT NULL
      AND reopened_by_actor_id IS NOT NULL
      AND reopened_reason IS NOT NULL
      AND LENGTH(BTRIM(reopened_reason)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_community_comment_version_approval_active
  ON community_comment_version_approval(realm, source_app, comment_version_id)
  WHERE reopened_at IS NULL;

CREATE TABLE IF NOT EXISTS community_comment_appeal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  case_id UUID NOT NULL,
  comment_version_id UUID NOT NULL,
  appellant_actor_id UUID NOT NULL REFERENCES community_actor(id),
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason)) > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'upheld', 'reversed')
  ),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  appeal_deadline_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  decided_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  decision_reason TEXT,
  CONSTRAINT community_comment_appeal_decision_check CHECK (
    (status = 'open'
      AND decided_at IS NULL
      AND decided_by_actor_id IS NULL
      AND decision_reason IS NULL)
    OR (status IN ('upheld', 'reversed')
      AND decided_at IS NOT NULL
      AND decided_by_actor_id IS NOT NULL
      AND decision_reason IS NOT NULL
      AND LENGTH(BTRIM(decision_reason)) > 0)
  ),
  CONSTRAINT community_comment_appeal_window_check CHECK (
    submitted_at <= appeal_deadline_at
  ),
  CONSTRAINT community_comment_appeal_case_version_fk
    FOREIGN KEY (realm, source_app, case_id, comment_version_id)
    REFERENCES community_moderation_case(
      realm,
      source_app,
      id,
      decision_version_id
    ),
  UNIQUE (realm, source_app, case_id)
);

CREATE OR REPLACE FUNCTION validate_community_comment_appeal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  case_closed_at TIMESTAMPTZ;
  case_terminal_action TEXT;
  comment_actor_id UUID;
BEGIN
  SELECT moderation_case.closed_at,
         moderation_case.terminal_action,
         community_comment.community_actor_id
  INTO case_closed_at, case_terminal_action, comment_actor_id
  FROM community_moderation_case AS moderation_case
  JOIN community_comment
    ON community_comment.realm = moderation_case.realm
   AND community_comment.source_app = moderation_case.source_app
   AND community_comment.id = moderation_case.comment_id
  WHERE moderation_case.realm = NEW.realm
    AND moderation_case.source_app = NEW.source_app
    AND moderation_case.id = NEW.case_id;

  IF NOT FOUND
    OR case_terminal_action <> 'remove'
    OR case_closed_at IS NULL
  THEN
    RAISE EXCEPTION 'recurso exige decisao terminal de remocao';
  END IF;

  IF comment_actor_id IS NULL OR comment_actor_id <> NEW.appellant_actor_id THEN
    RAISE EXCEPTION 'somente autor autenticado pode recorrer';
  END IF;

  IF NEW.appeal_deadline_at IS DISTINCT FROM case_closed_at + INTERVAL '6 months'
    OR NEW.submitted_at > case_closed_at + INTERVAL '6 months'
  THEN
    RAISE EXCEPTION 'recurso fora da janela de seis meses';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.community_comment_appeal'::regclass
      AND tgname = 'community_comment_appeal_validate_insert'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER community_comment_appeal_validate_insert
      BEFORE INSERT ON community_comment_appeal
      FOR EACH ROW
      EXECUTE FUNCTION validate_community_comment_appeal();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_restriction (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  actor_id UUID NOT NULL REFERENCES community_actor(id),
  scope TEXT NOT NULL CHECK (scope IN ('posting', 'commenting')),
  level TEXT NOT NULL CHECK (level IN (
    'warning',
    'temporary_suspension',
    'permanent_suspension'
  )),
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason)) > 0),
  imposed_by_actor_id UUID NOT NULL REFERENCES community_actor(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  lifted_by_actor_id UUID REFERENCES community_actor(id) ON DELETE SET NULL,
  lift_reason TEXT,
  CONSTRAINT community_restriction_duration_check CHECK (
    (level = 'temporary_suspension' AND expires_at IS NOT NULL AND expires_at > starts_at)
    OR (level IN ('warning', 'permanent_suspension') AND expires_at IS NULL)
  ),
  CONSTRAINT community_restriction_lift_check CHECK (
    (lifted_at IS NULL AND lifted_by_actor_id IS NULL AND lift_reason IS NULL)
    OR (lifted_at IS NOT NULL
      AND lifted_by_actor_id IS NOT NULL
      AND lift_reason IS NOT NULL
      AND LENGTH(BTRIM(lift_reason)) > 0)
  )
);

-- `source_app` fica FORA da unicidade de proposito: T2.1f pede "restricoes
-- centrais independentes" e o requisito 12i trata sancao como comunitaria, nao
-- por aplicativo. Suspensao por app deixaria o sancionado migrar de modulo e
-- seguir comentando, que e exatamente o que a sancao impede. `source_app`
-- continua na linha como proveniencia (onde a sancao foi imposta), sem entrar na
-- chave. Revisao da PR #241 sugeriu inclui-lo; recusado por contrariar T2.1f.
CREATE UNIQUE INDEX IF NOT EXISTS uq_community_restriction_active
  ON community_restriction(realm, actor_id, scope)
  WHERE lifted_at IS NULL AND level IN ('temporary_suspension', 'permanent_suspension');

CREATE TABLE IF NOT EXISTS community_moderation_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app IN ('downloads', 'site', 'mesas')),
  -- NO ACTION: tabela append-only, mesmo motivo de community_actor_link_audit.
  actor_id UUID REFERENCES community_actor(id),
  action TEXT NOT NULL CHECK (LENGTH(action) BETWEEN 1 AND 100),
  target_type TEXT NOT NULL CHECK (LENGTH(target_type) BETWEEN 1 AND 100),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason)) > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (JSONB_TYPEOF(metadata) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_moderation_audit_target
  ON community_moderation_audit(
    realm,
    source_app,
    target_type,
    target_id,
    occurred_at DESC,
    id DESC
  );

-- Estados terminais carregam ator/motivo/data na propria linha e exigem tambem
-- um evento append-only na mesma transacao. O trigger deferido deixa o handler
-- inserir estado e auditoria em qualquer ordem, mas recusa o COMMIT incompleto.
--
-- Achado de review da PR #241 (Codex P2), reproduzido em Postgres real: procurar
-- so por "existe linha de auditoria com este alvo/acao/ator/motivo" NAO prova
-- atomicidade. Auditoria commitada numa transacao anterior (handler que gravou e
-- falhou depois, ou reparo manual) era reusada por uma transicao posterior, que
-- passava sem auditoria propria. A coluna `xmin` do sistema resolve por
-- construcao: `xmin` da linha de auditoria e o txid que a inseriu, e comparar com
-- `pg_current_xact_id()` exige que ela tenha nascido NESTA transacao. Nao ha
-- coluna nova nem nonce a manter em sincronia pelo handler.
CREATE OR REPLACE FUNCTION require_community_terminal_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  required_action TEXT;
  required_actor UUID;
  required_reason TEXT;
BEGIN
  -- Achado de review da PR #241, reproduzido em Postgres real: as ramificacoes
  -- abaixo so olhavam UPDATE, entao INSERT direto em estado terminal (caso ja
  -- `closed`, denuncia ja resolvida, recurso ja decidido) entrava SEM auditoria
  -- nenhuma. O invariante de T2.1f e "nao existe estado terminal sem auditoria",
  -- independente de como a linha chegou ao estado. INSERT e UPDATE sao ramos
  -- separados de proposito: OLD so existe em UPDATE, e ler OLD em INSERT levanta
  -- erro de runtime no plpgsql.
  IF TG_TABLE_NAME = 'community_moderation_case' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status = 'closed' THEN
        required_action := 'case.closed';
        required_actor := NEW.closed_by_actor_id;
        required_reason := NEW.decision_reason;
      END IF;
    ELSIF OLD.status = 'open' AND NEW.status = 'closed' THEN
      required_action := 'case.closed';
      required_actor := NEW.closed_by_actor_id;
      required_reason := NEW.decision_reason;
    END IF;
  ELSIF TG_TABLE_NAME = 'community_comment_report' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.state <> 'active' THEN
        required_action := 'report.' || NEW.state;
        required_actor := NEW.resolved_by_actor_id;
        required_reason := NEW.resolution_reason;
      END IF;
    ELSIF OLD.state = 'active' AND NEW.state <> 'active' THEN
      required_action := 'report.' || NEW.state;
      required_actor := NEW.resolved_by_actor_id;
      required_reason := NEW.resolution_reason;
    END IF;
  ELSIF TG_TABLE_NAME = 'community_comment_version_approval' THEN
    IF TG_OP = 'INSERT' THEN
      -- Aprovacao nasce como ato terminal: todo INSERT exige auditoria. Uma
      -- aprovacao ja reaberta no INSERT exige o evento de reabertura, que e o
      -- estado final da linha.
      IF NEW.reopened_at IS NOT NULL THEN
        required_action := 'version.reopened';
        required_actor := NEW.reopened_by_actor_id;
        required_reason := NEW.reopened_reason;
      ELSE
        required_action := 'version.approved';
        required_actor := NEW.approved_by_actor_id;
        required_reason := NEW.approval_reason;
      END IF;
    ELSIF OLD.reopened_at IS NULL AND NEW.reopened_at IS NOT NULL THEN
      required_action := 'version.reopened';
      required_actor := NEW.reopened_by_actor_id;
      required_reason := NEW.reopened_reason;
    END IF;
  ELSIF TG_TABLE_NAME = 'community_comment_appeal' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'open' THEN
        required_action := 'appeal.' || NEW.status;
        required_actor := NEW.decided_by_actor_id;
        required_reason := NEW.decision_reason;
      END IF;
    ELSIF OLD.status = 'open' AND NEW.status <> 'open' THEN
      required_action := 'appeal.' || NEW.status;
      required_actor := NEW.decided_by_actor_id;
      required_reason := NEW.decision_reason;
    END IF;
  ELSIF TG_TABLE_NAME = 'community_restriction' THEN
    IF TG_OP = 'INSERT' THEN
      -- Restricao imposta ja levantada no mesmo INSERT: o ato que vale auditar e
      -- o levantamento, estado final da linha.
      IF NEW.lifted_at IS NOT NULL THEN
        required_action := 'restriction.lifted';
        required_actor := NEW.lifted_by_actor_id;
        required_reason := NEW.lift_reason;
      ELSE
        required_action := 'restriction.imposed';
        required_actor := NEW.imposed_by_actor_id;
        required_reason := NEW.reason;
      END IF;
    ELSIF OLD.lifted_at IS NULL AND NEW.lifted_at IS NOT NULL THEN
      required_action := 'restriction.lifted';
      required_actor := NEW.lifted_by_actor_id;
      required_reason := NEW.lift_reason;
    END IF;
  END IF;

  IF required_action IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM community_moderation_audit AS audit
    WHERE audit.realm = NEW.realm
      AND audit.source_app = NEW.source_app
      AND audit.target_type = TG_TABLE_NAME
      AND audit.target_id = NEW.id
      AND audit.action = required_action
      AND audit.actor_id = required_actor
      AND audit.reason = required_reason
      -- Prende a auditoria a ESTA transacao (Codex P2): xmin da linha e o txid
      -- que a inseriu. Sem isto, evento de transacao anterior servia de alibi.
      -- `pg_current_xact_id()::xid` trunca o xid8 de 64 bits para os mesmos 32
      -- bits de `xmin`, entao a igualdade sobrevive a wraparound; comparar por
      -- BIGINT (64 vs 32 bits) passaria a falhar depois do primeiro ciclo.
      AND audit.xmin = pg_current_xact_id()::xid
  ) THEN
    RAISE EXCEPTION '% exige auditoria atomica %', TG_TABLE_NAME, required_action;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'community_moderation_case',
    'community_comment_report',
    'community_comment_version_approval',
    'community_comment_appeal',
    'community_restriction'
  ] LOOP
    trigger_name := table_name || '_require_audit';
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || table_name)::regclass
        AND tgname = trigger_name
        AND NOT tgisinternal
    ) THEN
      EXECUTE FORMAT(
        'CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_community_terminal_audit()',
        trigger_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION guard_community_moderation_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'community_moderation_case' THEN
    IF OLD.status = 'closed' THEN
      RAISE EXCEPTION 'decisao terminal do caso e imutavel';
    END IF;
    IF OLD.id IS DISTINCT FROM NEW.id
      OR OLD.realm IS DISTINCT FROM NEW.realm
      OR OLD.source_app IS DISTINCT FROM NEW.source_app
      OR OLD.comment_id IS DISTINCT FROM NEW.comment_id
      OR OLD.opened_at IS DISTINCT FROM NEW.opened_at
    THEN
      RAISE EXCEPTION 'identidade do caso e imutavel';
    END IF;
  ELSIF TG_TABLE_NAME = 'community_comment_appeal' THEN
    IF OLD.status <> 'open' THEN
      RAISE EXCEPTION 'decisao terminal do recurso e imutavel';
    END IF;
    IF OLD.id IS DISTINCT FROM NEW.id
      OR OLD.realm IS DISTINCT FROM NEW.realm
      OR OLD.source_app IS DISTINCT FROM NEW.source_app
      OR OLD.case_id IS DISTINCT FROM NEW.case_id
      OR OLD.comment_version_id IS DISTINCT FROM NEW.comment_version_id
      OR OLD.appellant_actor_id IS DISTINCT FROM NEW.appellant_actor_id
      OR OLD.reason IS DISTINCT FROM NEW.reason
      OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at
      OR OLD.appeal_deadline_at IS DISTINCT FROM NEW.appeal_deadline_at
    THEN
      RAISE EXCEPTION 'evidencia do recurso e imutavel';
    END IF;
  ELSIF TG_TABLE_NAME = 'community_comment_version_approval' THEN
    IF OLD.reopened_at IS NOT NULL THEN
      RAISE EXCEPTION 'reabertura da aprovacao e imutavel';
    END IF;
    IF OLD.id IS DISTINCT FROM NEW.id
      OR OLD.realm IS DISTINCT FROM NEW.realm
      OR OLD.source_app IS DISTINCT FROM NEW.source_app
      OR OLD.comment_version_id IS DISTINCT FROM NEW.comment_version_id
      OR OLD.approved_by_actor_id IS DISTINCT FROM NEW.approved_by_actor_id
      OR OLD.approval_reason IS DISTINCT FROM NEW.approval_reason
      OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
    THEN
      RAISE EXCEPTION 'aprovacao de versao e imutavel';
    END IF;
  ELSIF TG_TABLE_NAME = 'community_restriction' THEN
    IF OLD.lifted_at IS NOT NULL THEN
      RAISE EXCEPTION 'levantamento da restricao e imutavel';
    END IF;
    IF OLD.id IS DISTINCT FROM NEW.id
      OR OLD.realm IS DISTINCT FROM NEW.realm
      OR OLD.source_app IS DISTINCT FROM NEW.source_app
      OR OLD.actor_id IS DISTINCT FROM NEW.actor_id
      OR OLD.scope IS DISTINCT FROM NEW.scope
      OR OLD.level IS DISTINCT FROM NEW.level
      OR OLD.reason IS DISTINCT FROM NEW.reason
      OR OLD.imposed_by_actor_id IS DISTINCT FROM NEW.imposed_by_actor_id
      OR OLD.starts_at IS DISTINCT FROM NEW.starts_at
      OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
    THEN
      RAISE EXCEPTION 'restricao aplicada e imutavel';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'community_moderation_case',
    'community_comment_version_approval',
    'community_comment_appeal',
    'community_restriction'
  ] LOOP
    trigger_name := table_name || '_guard_transition';
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || table_name)::regclass
        AND tgname = trigger_name
        AND NOT tgisinternal
    ) THEN
      EXECUTE FORMAT(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION guard_community_moderation_transition()',
        trigger_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION reject_immutable_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% e append-only', TG_TABLE_NAME;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'community_actor_link_audit',
    'community_comment_vote_audit',
    'community_moderation_audit',
    'notification_event'
  ] LOOP
    trigger_name := table_name || '_immutable';
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || table_name)::regclass
        AND tgname = trigger_name
        AND NOT tgisinternal
    ) THEN
      EXECUTE FORMAT(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_change()',
        trigger_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- community_comment_version so bloqueava UPDATE (achado de review da PR #241,
-- reproduzido em Postgres real: a versao era deletavel). Versao e a evidencia
-- fixada por `reported_version_id` em denuncia e por `decision_version_id` em
-- caso; apagar a linha destroi a prova da decisao. Expurgo de conteudo sensivel
-- ja tem caminho proprio e auditado (`redacted_at`), que zera o corpo e preserva
-- os metadados — DELETE nunca foi esse caminho. Fica aqui, e nao junto do
-- guard de UPDATE, porque reject_immutable_row_change() so existe a partir deste
-- ponto do arquivo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.community_comment_version'::regclass
      AND tgname = 'community_comment_version_reject_delete'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER community_comment_version_reject_delete
      BEFORE DELETE ON community_comment_version
      FOR EACH ROW
      EXECUTE FUNCTION reject_immutable_row_change();
  END IF;
END $$;

-- Preflight final: detecta arquivo aplicado contra schema incompleto. Nao testa
-- somente existencia das tabelas; prova os invariantes derivados mais caros.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_comment_score_version'
      AND column_name = 'score'
      AND is_generated = 'ALWAYS'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_comment_score_version'
      AND column_name = 'best_score'
      AND is_generated = 'ALWAYS'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_community_comment_report_active'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_community_moderation_case_open'
  ) THEN
    RAISE EXCEPTION 'schema comunitario do accounts incompleto';
  END IF;
END $$;
