-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-08-07
-- @description: Armazenamento de Idempotency-Key para escritas comunitarias nao idempotentes

-- Lacuna fechada aqui: o contrato (`contrato-http-v1.md` §6, `spec.md` 512-514)
-- exige `Idempotency-Key` em toda escrita nao idempotente desde a Fase 2, com
-- retencao de 24 horas e `409`/`idempotency_key_reuse` para payload divergente
-- — mas nenhuma migration criou onde guardar isso. A regra vive na §6 como
-- propriedade transversal de sete fluxos, e a tabela de rastreabilidade (§15)
-- organiza por fluxo, entao a idempotencia nao teve dono e nenhuma task de
-- schema (T2.1-T2.1f) a incluiu no escopo.
--
-- Sem esta tabela o `POST /internal/v1/comments` cumpriria o contrato apenas no
-- papel: o retry que o cliente faz depois de um timeout de rede criaria um
-- segundo comentario. E o modo de falha mais provavel de todos, porque a
-- fachada de cada modulo chama o `accounts.` pela rede — nao e cenario
-- hipotetico, e o caminho normal sob perda de pacote.

CREATE TABLE IF NOT EXISTS community_idempotency_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Escopo da chave. `realm` e `source_app` saem da credencial de servico
  -- (`contrato-http-v1.md` §1.1), nunca do corpo: sem eles na chave, o
  -- `downloads` de beta e o de producao compartilhariam espaco de nomes e um
  -- retry de beta devolveria a resposta gravada em prod. E a mesma fronteira
  -- que a migration 007 fechou para credencial, aplicada ao replay.
  realm TEXT NOT NULL CHECK (realm IN ('beta', 'prod')),
  source_app TEXT NOT NULL CHECK (source_app ~ '^[a-z][a-z0-9-]{1,31}$'),

  -- 8-128 ASCII imprimivel (`contrato-http-v1.md` §1.1). O CHECK repete o limite
  -- do handler de proposito: chave fora do formato nunca chega ao banco por
  -- nenhum caminho, inclusive script operacional que nao passe pelo handler.
  idempotency_key TEXT NOT NULL
    CHECK (idempotency_key ~ '^[\x20-\x7E]{8,128}$'),

  -- Rota a que a chave pertence. Duas rotas diferentes com a mesma chave sao
  -- operacoes diferentes; sem isto, reusar a chave de uma criacao numa edicao
  -- devolveria a resposta da criacao.
  operation TEXT NOT NULL CHECK (length(btrim(operation)) BETWEEN 1 AND 128),

  -- Ator da operacao, quando houver. Fica separado da chave unica: duas contas
  -- que colidem na mesma chave sob o mesmo `source_app` sao um reuso legitimo de
  -- chave alheia, e a resposta correta e `409`, nunca entregar a uma conta o
  -- corpo gravado pela outra.
  acting_user_id UUID,

  -- SHA-256 do payload canonico. Hash, e nao o corpo: o payload traz
  -- `body_markdown` do usuario, e guardar copia integral por 24 horas
  -- multiplicaria a superficie de conteudo hostil sem nenhum ganho — a
  -- comparacao so precisa distinguir "igual" de "diferente".
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),

  -- Resposta original, devolvida integralmente no replay de payload igual
  -- (`contrato-http-v1.md` §6: "mesmo status, mesmo corpo"). Reconstruir a
  -- resposta em vez de guarda-la faria o retry devolver estado atual, nao o
  -- gravado — e o cliente veria o comentario ja editado por outro caminho como
  -- se fosse o resultado da sua criacao.
  response_status SMALLINT NOT NULL CHECK (response_status BETWEEN 100 AND 599),
  response_body JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Retencao de 24 horas (`spec.md`:514). Coluna explicita, nao derivada de
  -- `created_at` na consulta: a janela e regra de contrato, e mante-la no dado
  -- deixa a limpeza e a leitura concordarem sem repetir o intervalo em dois
  -- lugares que podem divergir.
  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT community_idempotency_key_window CHECK (expires_at > created_at)
);

-- A unicidade E o mecanismo. O handler insere primeiro: `ON CONFLICT` disparado
-- significa que outra requisicao com a mesma chave ja passou, e o desempate vem
-- da comparacao de `request_hash` — payload igual devolve a resposta gravada,
-- diferente devolve `409`/`idempotency_key_reuse`.
--
-- Isto e deliberadamente diferente de consultar antes e inserir depois: duas
-- requisicoes concorrentes veriam ambas "chave livre" e criariam dois
-- comentarios. E o check-before-transaction que o `downloads` cometeu e que
-- `contrato-http-v1.md` §6 manda expressamente nao replicar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_community_idempotency_key
  ON community_idempotency_key(realm, source_app, operation, idempotency_key);

-- Limpeza do vencido. Parcial e por `expires_at` porque a varredura periodica so
-- olha o que ja venceu, e o indice cheio cresceria com o volume total de
-- escritas em vez do volume da janela.
CREATE INDEX IF NOT EXISTS ix_community_idempotency_key_expiry
  ON community_idempotency_key(expires_at);

COMMENT ON TABLE community_idempotency_key IS
  'Fase 2 (spec 090), contrato-http-v1.md §6 — replay de escrita nao idempotente. Payload igual devolve a resposta original; diferente devolve 409/idempotency_key_reuse. Retencao 24h (spec.md:514). Voto NAO usa esta tabela (decisao 12: estado absoluto, retry identico e no-op por construcao).';
COMMENT ON COLUMN community_idempotency_key.request_hash IS
  'SHA-256 do payload canonico. Hash e nao o corpo: guardar o body_markdown do usuario por 24h ampliaria a superficie de conteudo hostil sem ganho — a comparacao so distingue igual de diferente.';
COMMENT ON COLUMN community_idempotency_key.response_body IS
  'Resposta original integral. Reconstruir em vez de guardar faria o replay devolver estado atual, nao o gravado.';
COMMENT ON COLUMN community_idempotency_key.expires_at IS
  'Janela de 24h do contrato. Coluna explicita para limpeza e leitura concordarem sem repetir o intervalo em dois lugares.';
