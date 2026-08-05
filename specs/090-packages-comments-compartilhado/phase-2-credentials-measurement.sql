-- Evidência de T2.2a (spec 090, Fase 2, Bloco B). NÃO é migration: não tem
-- header de runner, não é aplicado pela esteira e termina em ROLLBACK.
--
-- Executar SEMPRE contra banco descartável, NUNCA contra `artificio_auth`. O
-- guard abaixo aborta se alguém apontar para o banco real por engano.
--
-- Uso (na VM, com a migration 007 já aplicada no banco descartável):
--   docker exec accounts-db psql -U admin -d <banco_descartavel> \
--     -v ON_ERROR_STOP=1 -f phase-2-credentials-measurement.sql
--
-- Cobre os invariantes que só o PostgreSQL decide: realm único por credencial,
-- domínio de realm/escopo, deduplicação por função IMMUTABLE, formato do hash e
-- do token_id, unicidade parcial de credencial ativa, exigência de motivo na
-- revogação e preservação do histórico após rotação.
--
-- Este arquivo sai do repositório quando a spec 090 fechar.

DO $guard$
BEGIN
  IF current_database() = 'artificio_auth' THEN
    RAISE EXCEPTION 'recusado: este script é evidência e nunca roda contra artificio_auth';
  END IF;
END $guard$;

\set ON_ERROR_STOP on
BEGIN;

-- O bloco BEGIN/EXCEPTION do plpgsql ja abre um savepoint implicito, entao um
-- INSERT recusado nao aborta a transacao externa. Sem isso, o primeiro teste
-- negativo envenenaria a transacao e todos os seguintes "passariam" por estarem
-- num contexto ja abortado — falso-positivo do mesmo tipo que o ROLLBACK deu no
-- Bloco A com a constraint DEFERRABLE.
CREATE OR REPLACE FUNCTION must_fail(stmt TEXT, label TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  sqlstate_captured TEXT;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sqlstate_captured = RETURNED_SQLSTATE;
    RAISE NOTICE 'ok (recusado, SQLSTATE=%): %', sqlstate_captured, label;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % foi aceito e deveria ter sido recusado', label;
END $$;

-- Linha base valida.
INSERT INTO community_service_credential
  (token_id, token_hash, source_app, realms, scopes, description)
VALUES
  ('downloads-prod-aaaa1111', '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
   'downloads', ARRAY['prod'], ARRAY['users.read'], 'base');

-- 1. Dois realms na mesma credencial: e o invariante central da task.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('x-prod-bbbb2222', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'x', ARRAY['beta','prod'], ARRAY['users.read'])
$$, 'credencial com dois realms');

-- 2. Realm fora do dominio.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('x-stag-bbbb2222', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'x', ARRAY['staging'], ARRAY['users.read'])
$$, 'realm invalido');

-- 3. Escopo fora do registro.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('x-prod-cccc3333', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'x', ARRAY['prod'], ARRAY['tudo.write'])
$$, 'escopo invalido');

-- 4. Escopo duplicado (a funcao IMMUTABLE que substituiu a subquery).
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('x-prod-dddd4444', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'x', ARRAY['prod'], ARRAY['users.read','users.read'])
$$, 'escopo duplicado');

-- 5. Hash que nao e Argon2id: barra SHA-256 entrando por engano.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('x-prod-eeee5555', 'e3b0c44298fc1c149afbf4c8996fb924', 'x', ARRAY['prod'], ARRAY['users.read'])
$$, 'hash nao-argon2id');

-- 6. token_id fora do formato.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('MAIUSCULA', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'x', ARRAY['prod'], ARRAY['users.read'])
$$, 'token_id maiusculo');

-- 7. Segunda credencial ATIVA no MESMO slot do mesmo par.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('downloads-prod-ffff6666', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'downloads', ARRAY['prod'], ARRAY['users.read'])
$$, 'segunda credencial ativa do mesmo par');

-- 8. Mesmo app em realm DIFERENTE e permitido: e o modelo de uma por app por realm.
INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
VALUES ('downloads-beta-7777aaaa', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'downloads', ARRAY['beta'], ARRAY['users.read']);

-- 9. Revogar exige motivo.
SELECT must_fail($$
  UPDATE community_service_credential SET revoked_at = now() WHERE token_id = 'downloads-prod-aaaa1111'
$$, 'revogacao sem motivo');

-- 10. Revogada libera o slot para uma credencial nova do mesmo par (rotacao).
UPDATE community_service_credential
  SET revoked_at = now(), revoked_reason = 'rotacao de teste'
  WHERE token_id = 'downloads-prod-aaaa1111';

INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
VALUES ('downloads-prod-8888bbbb', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'downloads', ARRAY['prod'], ARRAY['users.read']);

-- 11. A revogada continua existindo: o historico de quem escreveu o que sobrevive.
DO $$
DECLARE total INT;
BEGIN
  SELECT count(*) INTO total FROM community_service_credential WHERE source_app = 'downloads';
  IF total <> 3 THEN
    RAISE EXCEPTION 'FALHOU: esperava 3 linhas de downloads (1 revogada + 2 ativas), achei %', total;
  END IF;
  RAISE NOTICE 'ok: revogada preservada, rotacao concluida (% linhas)', total;
END $$;

-- 12. Escopos vazios.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes)
  VALUES ('x-prod-9999cccc', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'x', ARRAY['prod'], ARRAY[]::TEXT[])
$$, 'scopes vazio');

-- 13. Janela de rotacao `current` + `next` (spec.md §"Trust boundary e
-- credenciais"): as duas precisam coexistir ATIVAS, senao a rotacao exige
-- downtime e o segredo acaba nunca sendo rotacionado.
INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes, rotation_slot)
VALUES ('downloads-prod-next0001', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'downloads', ARRAY['prod'], ARRAY['users.read'], 'next');

DO $$
DECLARE ativas INT;
BEGIN
  SELECT count(*) INTO ativas
    FROM community_service_credential
    WHERE source_app = 'downloads' AND realms[1] = 'prod' AND revoked_at IS NULL;
  IF ativas <> 2 THEN
    RAISE EXCEPTION 'FALHOU: rotacao exige current+next ativas, achei %', ativas;
  END IF;
  RAISE NOTICE 'ok: current e next coexistem ativas (rotacao sem downtime)';
END $$;

-- 14. Duas no MESMO slot continua recusado: o slot organiza, nao afrouxa.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes, rotation_slot)
  VALUES ('downloads-prod-next0002', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'downloads', ARRAY['prod'], ARRAY['users.read'], 'next')
$$, 'segunda credencial ativa no slot next');

-- 15. Slot fora do dominio.
SELECT must_fail($$
  INSERT INTO community_service_credential (token_id, token_hash, source_app, realms, scopes, rotation_slot)
  VALUES ('x-prod-slot0003', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', 'x', ARRAY['prod'], ARRAY['users.read'], 'terceiro')
$$, 'rotation_slot invalido');

DO $$ BEGIN RAISE NOTICE 'cred007: todos os invariantes passaram'; END $$;
ROLLBACK;
