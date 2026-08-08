-- Evidência da Fase 2 (T2.6c) da spec 090: exercita os invariantes que o
-- SCHEMA garante sozinho na escrita transacional de comentário — os que
-- `communityCommentWrite.ts` depende e não pode provar em TypeScript.
--
-- NÃO é migration — roda em transação e termina em ROLLBACK, sem deixar estado.
-- Fica aqui, e não em apps/accounts/src/, porque _enforce-migration-dir.yml
-- bloqueia qualquer .sql fora da allowlist; o padrão
-- specs/*/phase-*-measurement.sql existe para evidência de spec e sai quando a
-- spec fechar.
--
-- Uso: psql -v ON_ERROR_STOP=1 -f <este arquivo> contra um banco descartável com
-- as migrations 001-009 aplicadas. Nunca rodar contra artificio_auth.

\set ON_ERROR_STOP on

-- Trava de destino, idêntica à de phase-2-measurement.sql: o accounts. é
-- PROD-only e `artificio_auth` é o banco do SSO em produção. O script termina em
-- ROLLBACK, mas um ROLLBACK esquecido ou uma interrupção no meio deixariam
-- escrita no banco errado.
DO $$
BEGIN
  IF current_database() = 'artificio_auth' THEN
    RAISE EXCEPTION 'recusado: este script é de medição e nunca roda em artificio_auth';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE
  actor_id UUID;
  outro_actor_id UUID;
  user_id UUID;
  raiz_id UUID := gen_random_uuid();
  raiz_versao_id UUID := gen_random_uuid();
  filho_id UUID;
  evento_id UUID := gen_random_uuid();
  fundo_id UUID;
  pai_atual UUID;
  nivel INT;
BEGIN
  -- Fixtures mínimos.
  INSERT INTO users (id, google_sub, email, name)
  VALUES (gen_random_uuid(), 'g-t26c', 't26c@example.test', 'T26C')
  RETURNING id INTO user_id;

  INSERT INTO community_actor DEFAULT VALUES RETURNING id INTO actor_id;
  INSERT INTO community_actor DEFAULT VALUES RETURNING id INTO outro_actor_id;
  INSERT INTO community_actor_account_link (actor_id, user_id)
  VALUES (actor_id, user_id);

  INSERT INTO community_comment_subject
    (realm, source_app, subject_type, subject_id, canonical_path, owner_user_id)
  VALUES ('beta', 'site', 'site.post', 'p1', '/blog/p1/', NULL);

  -- ============================================================
  -- 1. FK circular comentário <-> versão é DEFERRABLE.
  -- ============================================================
  -- `communityCommentWrite.ts` insere o comentário ANTES da versão que
  -- `current_version_id` referencia. Isso só funciona porque
  -- `community_comment_current_version_fk` é DEFERRABLE INITIALLY DEFERRED. Se
  -- alguém a tornar imediata, o handler quebra em produção na primeira escrita —
  -- e o erro apareceria como 500 genérico, não como violação óbvia.
  INSERT INTO community_comment (
    id, realm, source_app, subject_type, subject_id, community_actor_id,
    parent_id, root_id, depth, body_markdown, current_version_id, created_revision
  ) VALUES (
    raiz_id, 'beta', 'site', 'site.post', 'p1', actor_id,
    NULL, raiz_id, 0, 'raiz', raiz_versao_id, 0
  );

  INSERT INTO community_comment_version (
    id, realm, source_app, comment_id, authored_by_actor_id, body_markdown
  ) VALUES (
    raiz_versao_id, 'beta', 'site', raiz_id, actor_id, 'raiz'
  );

  -- ============================================================
  -- 2. `depth` acima de 4 é recusado pelo CHECK.
  -- ============================================================
  -- `placeComment` recusa antes de chegar aqui, com 422 e motivo. Este teste
  -- prova a SEGUNDA barreira: se a validação em TypeScript for contornada ou
  -- esquecida numa rota futura, o banco ainda recusa.
  pai_atual := raiz_id;
  FOR nivel IN 1..4 LOOP
    fundo_id := gen_random_uuid();
    filho_id := gen_random_uuid();
    INSERT INTO community_comment (
      id, realm, source_app, subject_type, subject_id, community_actor_id,
      parent_id, root_id, depth, body_markdown, current_version_id, created_revision
    ) VALUES (
      fundo_id, 'beta', 'site', 'site.post', 'p1', actor_id,
      pai_atual, raiz_id, nivel, 'nivel ' || nivel, filho_id, 0
    );
    INSERT INTO community_comment_version (id, realm, source_app, comment_id, authored_by_actor_id, body_markdown)
    VALUES (filho_id, 'beta', 'site', fundo_id, actor_id, 'nivel ' || nivel);
    pai_atual := fundo_id;
  END LOOP;

  BEGIN
    filho_id := gen_random_uuid();
    INSERT INTO community_comment (
      id, realm, source_app, subject_type, subject_id, community_actor_id,
      parent_id, root_id, depth, body_markdown, current_version_id, created_revision
    ) VALUES (
      gen_random_uuid(), 'beta', 'site', 'site.post', 'p1', actor_id,
      pai_atual, raiz_id, 5, 'nivel 5', filho_id, 0
    );
    RAISE EXCEPTION 'depth=5 foi aceito';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- ============================================================
  -- 3. Raiz precisa ter `root_id = id`.
  -- ============================================================
  -- `placeComment` devolve `root_id: null` na raiz justamente porque o id só
  -- existe no INSERT; o handler preenche com o próprio id. Se ele passar outro
  -- valor, o CHECK recusa — é o que impede uma "raiz" pendurada na árvore alheia.
  BEGIN
    filho_id := gen_random_uuid();
    INSERT INTO community_comment (
      id, realm, source_app, subject_type, subject_id, community_actor_id,
      parent_id, root_id, depth, body_markdown, current_version_id, created_revision
    ) VALUES (
      gen_random_uuid(), 'beta', 'site', 'site.post', 'p1', actor_id,
      NULL, raiz_id, 0, 'raiz falsa', filho_id, 0
    );
    RAISE EXCEPTION 'raiz com root_id de outro comentario foi aceita';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  -- ============================================================
  -- 4. Recibo duplicado para o mesmo (evento, destinatário) é recusado.
  -- ============================================================
  -- `resolveNotificationRecipients` deduplica ANTES do INSERT (regra de produto
  -- 15c). Esta unicidade é a segunda barreira: se uma origem nova de
  -- destinatário entrar sem passar pela dedupe, o banco recusa em vez de mandar
  -- dois sinos para a mesma pessoa pelo mesmo fato.
  -- `notification_event` tem DUAS colunas de identidade, e confundi-las quebra
  -- o FK do recibo: `id` é a chave da linha, `event_id` é a chave de
  -- idempotência do produtor externo (`spec.md` 13c, evento vindo de outro
  -- módulo por outbox). `notification_receipt_event_fk` aponta para
  -- `(realm, source_app, id)`, NÃO para `event_id`. O handler errou isso na
  -- primeira versão e só este script pegou.
  INSERT INTO notification_event (
    id, event_id, realm, source_app, event_type, event_version,
    subject_type, subject_id, actor_id, canonical_path, snapshot
  ) VALUES (
    evento_id, gen_random_uuid(), 'beta', 'site', 'comment.created', 1,
    'site.post', 'p1', actor_id, '/blog/p1/', '{"comment_id":"x"}'::jsonb
  );

  INSERT INTO notification_receipt (realm, source_app, event_id, recipient_user_id)
  VALUES ('beta', 'site', evento_id, user_id);

  BEGIN
    INSERT INTO notification_receipt (realm, source_app, event_id, recipient_user_id)
    VALUES ('beta', 'site', evento_id, user_id);
    RAISE EXCEPTION 'recibo duplicado foi aceito';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- O recibo referencia `notification_event.id`. Passar o `event_id` do produtor
  -- no lugar viola a FK — é exatamente o defeito que o handler tinha.
  BEGIN
    INSERT INTO notification_receipt (realm, source_app, event_id, recipient_user_id)
    VALUES ('beta', 'site', gen_random_uuid(), user_id);
    RAISE EXCEPTION 'recibo apontando para evento inexistente foi aceito';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  -- ============================================================
  -- 5. Idempotência: mesma chave duas vezes é recusada.
  -- ============================================================
  -- É o mecanismo inteiro de §6: o handler INSERE primeiro e trata a violação,
  -- em vez de consultar antes (check-before-transaction, o defeito do
  -- `downloads` que a spec manda não replicar).
  INSERT INTO community_idempotency_key (
    realm, source_app, idempotency_key, operation, acting_user_id,
    request_hash, response_status, response_body, expires_at
  ) VALUES (
    'beta', 'site', 'chave-de-teste-0001', 'comment.create', user_id,
    repeat('a', 64), 201, '{}'::jsonb, now() + interval '24 hours'
  );

  BEGIN
    INSERT INTO community_idempotency_key (
      realm, source_app, idempotency_key, operation, acting_user_id,
      request_hash, response_status, response_body, expires_at
    ) VALUES (
      'beta', 'site', 'chave-de-teste-0001', 'comment.create', user_id,
      repeat('b', 64), 201, '{}'::jsonb, now() + interval '24 hours'
    );
    RAISE EXCEPTION 'chave de idempotencia duplicada foi aceita';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- A mesma chave em OUTRO realm é legítima: realm separa beta de prod na mesma
  -- tabela (`spec.md` 5a), e uma chave gerada em beta não pode colidir com prod.
  INSERT INTO community_comment_subject
    (realm, source_app, subject_type, subject_id, canonical_path, owner_user_id)
  VALUES ('prod', 'site', 'site.post', 'p1', '/blog/p1/', NULL);

  INSERT INTO community_idempotency_key (
    realm, source_app, idempotency_key, operation, acting_user_id,
    request_hash, response_status, response_body, expires_at
  ) VALUES (
    'prod', 'site', 'chave-de-teste-0001', 'comment.create', user_id,
    repeat('a', 64), 201, '{}'::jsonb, now() + interval '24 hours'
  );

  -- ============================================================
  -- 6. Resposta cross-subject é impossível pela FK composta.
  -- ============================================================
  -- `placeComment` recusa com `parent_not_found`. Aqui se prova que, mesmo
  -- contornada, a FK `community_comment_parent_subject_fk` — que carrega
  -- (realm, source_app, subject_type, subject_id) na chave — recusa.
  INSERT INTO community_comment_subject
    (realm, source_app, subject_type, subject_id, canonical_path, owner_user_id)
  VALUES ('beta', 'site', 'site.post', 'p2', '/blog/p2/', NULL);

  -- `community_comment_parent_subject_fk` é DEFERRABLE INITIALLY DEFERRED (o
  -- mesmo mecanismo que permite o ciclo comentário<->versão), então ela NÃO
  -- dispara no `INSERT` — só no `COMMIT`. `SET CONSTRAINTS ... IMMEDIATE` força
  -- a checagem aqui, dentro do bloco, para o teste medir o que quer medir.
  --
  -- Consequência que o handler precisa respeitar: `placeComment` é a PRIMEIRA
  -- barreira, não um luxo. Sem ela, uma resposta cross-subject atravessaria toda
  -- a transação — comentário, versão, evento, recibos — e só estouraria no
  -- commit, como erro genérico sem os `404`/`422` que o contrato exige.
  BEGIN
    SET CONSTRAINTS community_comment_parent_subject_fk IMMEDIATE;
    filho_id := gen_random_uuid();
    INSERT INTO community_comment (
      id, realm, source_app, subject_type, subject_id, community_actor_id,
      parent_id, root_id, depth, body_markdown, current_version_id, created_revision
    ) VALUES (
      gen_random_uuid(), 'beta', 'site', 'site.post', 'p2', actor_id,
      raiz_id, raiz_id, 1, 'cross subject', filho_id, 0
    );
    RAISE EXCEPTION 'resposta cross-subject foi aceita';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  SET CONSTRAINTS community_comment_parent_subject_fk DEFERRED;

  RAISE NOTICE 'T2.6c: todos os invariantes de escrita passaram';
END $$;

ROLLBACK;
