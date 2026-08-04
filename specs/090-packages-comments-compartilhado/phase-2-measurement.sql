-- Evidência da Fase 2 (Bloco A) da spec 090: exercita os invariantes de
-- apps/accounts/database/migration_006_community_comments.sql contra PostgreSQL
-- real. NÃO é migration — roda em transação e termina em ROLLBACK, sem deixar
-- estado. Fica aqui, e não em apps/accounts/src/, porque
-- _enforce-migration-dir.yml bloqueia qualquer .sql fora da allowlist; o padrão
-- specs/*/phase-*-measurement.sql existe para evidência de spec e sai quando a
-- spec fechar.
--
-- Uso: psql -v ON_ERROR_STOP=1 -f <este arquivo> contra um banco descartável com
-- as migrations 001-006 aplicadas. Nunca rodar contra artificio_auth.

\set ON_ERROR_STOP on

BEGIN;

DO $$
<<fixtures>>
DECLARE
  owner_user_id UUID := uuid_generate_v4();
  voter_user_id UUID := uuid_generate_v4();
  owner_actor_id UUID := uuid_generate_v4();
  voter_actor_id UUID := uuid_generate_v4();
  comment_id UUID := uuid_generate_v4();
  version_id UUID := uuid_generate_v4();
  case_id UUID := uuid_generate_v4();
  report_id UUID := uuid_generate_v4();
  restriction_id UUID := uuid_generate_v4();
  decision_at TIMESTAMPTZ;
BEGIN
  INSERT INTO users (id, google_sub, email, name)
  VALUES
    (owner_user_id, 'spec090-owner', 'owner@example.invalid', 'Owner'),
    (voter_user_id, 'spec090-voter', 'voter@example.invalid', 'Voter');

  INSERT INTO community_actor (id) VALUES (owner_actor_id), (voter_actor_id);
  INSERT INTO community_actor_account_link (actor_id, user_id)
  VALUES (owner_actor_id, owner_user_id), (voter_actor_id, voter_user_id);

  INSERT INTO community_comment_subject (
    realm,
    source_app,
    subject_type,
    subject_id,
    canonical_path,
    owner_user_id
  ) VALUES ('beta', 'site', 'site.post', 'spec-090', '/blog/spec-090/', owner_user_id);

  INSERT INTO community_comment (
    id,
    realm,
    source_app,
    subject_type,
    subject_id,
    community_actor_id,
    root_id,
    depth,
    body_markdown,
    current_version_id,
    created_revision
  ) VALUES (
    comment_id,
    'beta',
    'site',
    'site.post',
    'spec-090',
    owner_actor_id,
    comment_id,
    0,
    'comentario de integracao',
    version_id,
    0
  );

  INSERT INTO community_comment_version (
    id,
    realm,
    source_app,
    comment_id,
    authored_by_actor_id,
    body_markdown
  ) VALUES (
    version_id,
    'beta',
    'site',
    comment_id,
    owner_actor_id,
    'comentario de integracao'
  );

  INSERT INTO community_comment_score_version (
    realm,
    source_app,
    comment_id,
    valid_from_revision,
    upvotes,
    downvotes
  ) VALUES ('beta', 'site', comment_id, 0, 0, 0);

  IF NOT EXISTS (
    SELECT 1
    FROM community_comment_score_version
    WHERE community_comment_score_version.comment_id = fixtures.comment_id
      AND score = 0
      AND best_score = 0
      AND algorithm_version = 'reddit-wilson-80-v1'
  ) THEN
    RAISE EXCEPTION 'score inicial ou Wilson zero incorreto';
  END IF;

  BEGIN
    INSERT INTO community_comment_score_version (
      realm,
      source_app,
      comment_id,
      valid_from_revision,
      upvotes,
      downvotes
    ) VALUES ('beta', 'site', comment_id, 1, -1, 0);
    RAISE EXCEPTION 'contagem negativa foi aceita';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO community_comment_score_version (
      realm,
      source_app,
      comment_id,
      valid_from_revision,
      upvotes,
      downvotes,
      score
    ) VALUES ('beta', 'site', comment_id, 1, 1, 0, 999);
    RAISE EXCEPTION 'gravacao direta de score foi aceita';
  EXCEPTION WHEN generated_always THEN
    NULL;
  END;

  INSERT INTO community_comment_vote (
    realm,
    source_app,
    community_actor_id,
    comment_id,
    value
  ) VALUES ('beta', 'site', voter_actor_id, comment_id, 1);

  DELETE FROM community_actor_account_link WHERE actor_id = voter_actor_id;
  IF NOT EXISTS (
    SELECT 1 FROM community_comment_vote
    WHERE community_actor_id = voter_actor_id
      AND community_comment_vote.comment_id = fixtures.comment_id
  ) THEN
    RAISE EXCEPTION 'expurgo do vinculo apagou voto';
  END IF;

  INSERT INTO community_moderation_case (
    id,
    realm,
    source_app,
    comment_id
  ) VALUES (case_id, 'beta', 'site', comment_id);

  BEGIN
    INSERT INTO community_comment_report (
      realm,
      source_app,
      comment_id,
      reported_version_id,
      reporter_actor_id,
      case_id,
      reason_code
    ) VALUES (
      'beta',
      'site',
      comment_id,
      version_id,
      voter_actor_id,
      case_id,
      'other'
    );
    RAISE EXCEPTION 'motivo obrigatorio aceitou detalhes ausentes';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%exige detalhes%' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO community_comment_report (
    id,
    realm,
    source_app,
    comment_id,
    reported_version_id,
    reporter_actor_id,
    case_id,
    reason_code,
    details
  ) VALUES (
    report_id,
    'beta',
    'site',
    comment_id,
    version_id,
    voter_actor_id,
    case_id,
    'other',
    'teste de integracao'
  );

  BEGIN
    INSERT INTO community_comment_report (
      realm,
      source_app,
      comment_id,
      reported_version_id,
      reporter_actor_id,
      case_id,
      reason_code,
      details
    ) VALUES (
      'beta',
      'site',
      comment_id,
      version_id,
      voter_actor_id,
      case_id,
      'other',
      'duplicada'
    );
    RAISE EXCEPTION 'segunda denuncia ativa foi aceita';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO community_moderation_case (
      realm,
      source_app,
      comment_id
    ) VALUES ('beta', 'site', comment_id);
    RAISE EXCEPTION 'segundo caso aberto foi aceito';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO community_restriction (
      realm,
      source_app,
      actor_id,
      scope,
      level,
      reason,
      imposed_by_actor_id
    ) VALUES (
      'beta',
      'site',
      voter_actor_id,
      'commenting',
      'temporary_suspension',
      'sem expiracao',
      owner_actor_id
    );
    RAISE EXCEPTION 'restricao temporaria sem expiracao foi aceita';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE community_moderation_case
    SET status = 'closed',
        terminal_action = 'remove',
        decision_version_id = version_id,
        closed_at = NOW(),
        closed_by_actor_id = owner_actor_id,
        decision_reason = 'sem auditoria'
    WHERE id = case_id;
    SET CONSTRAINTS community_moderation_case_require_audit IMMEDIATE;
    RAISE EXCEPTION 'estado terminal sem auditoria foi aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%exige auditoria atomica%' THEN
      RAISE;
    END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;

  UPDATE community_comment_report
  SET state = 'upheld',
      resolved_at = NOW(),
      resolved_by_actor_id = owner_actor_id,
      resolution_reason = 'procedente'
  WHERE id = report_id;
  INSERT INTO community_moderation_audit (
    realm,
    source_app,
    actor_id,
    action,
    target_type,
    target_id,
    reason
  ) VALUES (
    'beta',
    'site',
    owner_actor_id,
    'report.upheld',
    'community_comment_report',
    report_id,
    'procedente'
  );

  UPDATE community_moderation_case
  SET status = 'closed',
      terminal_action = 'remove',
      decision_version_id = version_id,
      closed_at = NOW(),
      closed_by_actor_id = owner_actor_id,
      decision_reason = 'remocao de teste'
  WHERE id = case_id
  RETURNING closed_at INTO decision_at;
  INSERT INTO community_moderation_audit (
    realm,
    source_app,
    actor_id,
    action,
    target_type,
    target_id,
    reason
  ) VALUES (
    'beta',
    'site',
    owner_actor_id,
    'case.closed',
    'community_moderation_case',
    case_id,
    'remocao de teste'
  );

  INSERT INTO community_comment_appeal (
    realm,
    source_app,
    case_id,
    comment_version_id,
    appellant_actor_id,
    reason,
    appeal_deadline_at
  ) VALUES (
    'beta',
    'site',
    case_id,
    version_id,
    owner_actor_id,
    'recurso de teste',
    decision_at + INTERVAL '6 months'
  );

  BEGIN
    INSERT INTO community_comment_appeal (
      realm,
      source_app,
      case_id,
      comment_version_id,
      appellant_actor_id,
      reason,
      appeal_deadline_at
    ) VALUES (
      'beta',
      'site',
      case_id,
      version_id,
      owner_actor_id,
      'segundo recurso',
      decision_at + INTERVAL '6 months'
    );
    RAISE EXCEPTION 'segundo recurso foi aceito';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO community_restriction (
    id,
    realm,
    source_app,
    actor_id,
    scope,
    level,
    reason,
    imposed_by_actor_id,
    expires_at
  ) VALUES (
    restriction_id,
    'beta',
    'site',
    voter_actor_id,
    'commenting',
    'temporary_suspension',
    'restricao de teste',
    owner_actor_id,
    NOW() + INTERVAL '1 day'
  );
  INSERT INTO community_moderation_audit (
    realm,
    source_app,
    actor_id,
    action,
    target_type,
    target_id,
    reason
  ) VALUES (
    'beta',
    'site',
    owner_actor_id,
    'restriction.imposed',
    'community_restriction',
    restriction_id,
    'restricao de teste'
  );

  SET CONSTRAINTS ALL IMMEDIATE;
END;
$$;

ROLLBACK;
