-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-08-04
-- @description: Registro de credenciais de servico por source_app e realm

-- T2.2a. Substitui o `SERVICE_SECRET` unico e global por um registro de
-- credenciais que identifica QUEM chamou, nao apenas se o segredo confere.
--
-- O mecanismo antigo (`isValidServiceToken`, src/serviceToken.ts) responde uma
-- pergunta booleana: "esse token e igual ao segredo?". A escrita comunitaria
-- precisa de tres respostas — qual `source_app`, qual `realm`, quais operacoes.
-- Com um valor unico as tres sao a mesma, logo nenhuma delas e resposta, e
-- `realm` so poderia vir do payload: exatamente o que `spec.md` §"Trust boundary
-- e credenciais" proibe. Medicao de 2026-08-04 confirmou o mesmo digest de
-- `SERVICE_SECRET` em seis servicos e nos dois realms.

-- `CHECK` do PostgreSQL nao aceita subquery, entao `cardinality(ARRAY(SELECT
-- DISTINCT unnest(...)))` — a forma obvia de exigir array sem duplicata — falha
-- com "cannot use subquery in check constraint". A funcao encapsula a deduplicacao
-- num escopo onde a subquery e permitida; `IMMUTABLE` e obrigatorio para poder ser
-- usada em constraint. `STRICT` devolve NULL para entrada NULL, e o `NOT NULL` da
-- coluna e quem barra esse caso.
CREATE OR REPLACE FUNCTION community_text_array_has_no_duplicate(items TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT cardinality(items) = (SELECT count(DISTINCT item) FROM unnest(items) AS item);
$$;

CREATE TABLE IF NOT EXISTS community_service_credential (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Prefixo publico do header `<token_id>.<segredo>`. Nao e secreto: existe para
  -- que a verificacao faca UM `SELECT` por indice em vez de rodar Argon2id
  -- contra toda linha da tabela (custo proibitivo e proporcional ao numero de
  -- credenciais, o que viraria vetor de DoS conforme o registro cresce).
  token_id TEXT NOT NULL UNIQUE
    CHECK (token_id ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),

  -- Argon2id, nao SHA-256. Aqui e armazenamento de credencial, nao normalizacao
  -- de tamanho: vazamento da tabela sem KDF memory-hard permitiria forca bruta
  -- offline. `serviceToken.ts` usa SHA-256 corretamente para o outro proposito
  -- (igualar comprimento antes de `timingSafeEqual`); os dois usos sao distintos
  -- e a distincao precisa sobreviver a leituras futuras.
  token_hash TEXT NOT NULL
    CHECK (token_hash LIKE '$argon2id$%'),

  source_app TEXT NOT NULL
    CHECK (source_app ~ '^[a-z][a-z0-9-]{1,31}$'),

  -- Array pelo caso excepcional documentado, mas toda credencial emitida nasce
  -- com UM realm (guard abaixo). E isto que torna "beta grava realm=prod"
  -- impossivel por construcao, e nao por validacao que alguem precisa lembrar
  -- de escrever no handler.
  realms TEXT[] NOT NULL
    CHECK (
      cardinality(realms) > 0
      AND realms <@ ARRAY['beta', 'prod']::TEXT[]
      AND community_text_array_has_no_duplicate(realms)
    ),

  -- Escopo por operacao. O segredo global de hoje nao tem nenhum: quem pode
  -- resolver e-mail de usuario (`/internal/users/:id`) tambem le segredo
  -- decifrado (`/admin/secrets/:name`, chave da DeepSeek entre outros).
  scopes TEXT[] NOT NULL
    CHECK (
      cardinality(scopes) > 0
      AND scopes <@ ARRAY[
        'users.read',
        'secrets.read',
        'comment.write',
        'comment.read',
        'vote.write',
        'report.write',
        'moderation.write'
      ]::TEXT[]
      AND community_text_array_has_no_duplicate(scopes)
    ),

  -- Papel na janela de rotacao (`spec.md` §"Trust boundary e credenciais").
  -- `current` e a credencial em uso; `next` e a publicada durante a troca. Ambas
  -- autenticam igual — o slot organiza a rotacao, nao restringe acesso.
  rotation_slot TEXT NOT NULL DEFAULT 'current'
    CHECK (rotation_slot IN ('current', 'next')),

  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,

  -- Revogacao granular: e o que o segredo unico nao permite hoje. Rotacionar
  -- `SERVICE_SECRET` exige trocar seis `.env` ao mesmo tempo, entao na pratica
  -- ele nao e rotacionado — e segredo que nao pode ser rotacionado permanece em
  -- uso depois de suspeito.
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Observabilidade de uso, para provar que uma credencial pode ser removida
  -- antes de remove-la. Nunca registra o segredo.
  last_used_at TIMESTAMPTZ,

  CONSTRAINT community_service_credential_revocation_coherent CHECK (
    (revoked_at IS NULL AND revoked_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL AND length(btrim(revoked_reason)) > 0)
  )
);

-- Rotacao sem downtime (`spec.md` §"Trust boundary e credenciais"): a janela
-- curta `current` + `next` exige que DUAS credenciais do mesmo par coexistam
-- ativas — publica `next` no `accounts.`, troca o consumidor, confirma trafego,
-- revoga `current`. Um indice unico sobre (source_app, realm) ativo tornaria
-- essa sequencia impossivel e forcaria janela de indisponibilidade a cada
-- rotacao, que e como um segredo acaba nunca sendo rotacionado.
--
-- O `rotation_slot` nomeia o papel de cada uma. Unicidade parcial por
-- (source_app, realm, slot): no maximo uma `current` e uma `next` ativas por par,
-- nunca duas no mesmo papel. Revogada sai do indice mas permanece na tabela —
-- apagar a linha destruiria a trilha de qual credencial escreveu o que.
--
-- `unnest` num indice exigiria funcao IMMUTABLE sobre a linha inteira, entao a
-- unicidade usa `realms[1]`, seguro porque o CHECK abaixo garante realm unico.
CREATE UNIQUE INDEX IF NOT EXISTS uq_community_service_credential_active
  ON community_service_credential(source_app, (realms[1]), rotation_slot)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_community_service_credential_lookup
  ON community_service_credential(token_id)
  WHERE revoked_at IS NULL;

-- Guard de realm unico por credencial. Fica como CHECK e nao so como convencao
-- do emissor porque e a garantia estrutural que impede beta de afirmar prod:
-- com `cardinality(realms) = 1`, o handler deriva o realm sem escolha possivel.
-- Ampliar para multi-realm exige migration nova e decisao explicita — que e o
-- ponto: a excecao deve custar uma decisao, nao um argumento a mais na chamada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.community_service_credential'::regclass
      AND conname = 'community_service_credential_single_realm'
  ) THEN
    ALTER TABLE community_service_credential
      ADD CONSTRAINT community_service_credential_single_realm
      CHECK (cardinality(realms) = 1);
  END IF;
END $$;

COMMENT ON TABLE community_service_credential IS
  'T2.2a — credencial de servico por source_app e realm. Substitui SERVICE_SECRET global. realm/source_app sao DERIVADOS daqui, nunca aceitos do payload.';
COMMENT ON COLUMN community_service_credential.token_id IS
  'Prefixo publico do header <token_id>.<segredo>. Nao e secreto; existe para lookup por indice sem rodar KDF contra a tabela inteira.';
COMMENT ON COLUMN community_service_credential.token_hash IS
  'Argon2id do segredo. Nunca o segredo em claro. Nao trocar por hash rapido: protege contra forca bruta offline se a tabela vazar.';
COMMENT ON COLUMN community_service_credential.realms IS
  'Sempre exatamente um realm (CHECK community_service_credential_single_realm). Array existe so para o caso excepcional que exigira migration propria.';
