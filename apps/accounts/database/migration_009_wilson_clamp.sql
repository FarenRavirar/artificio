-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-08-07
-- @description: Corrige Wilson negativo por cancelamento catastrofico quando upvotes=0

-- T2.3b. `comment_wilson_reddit_80_v1(0, d)` devolvia ~-1e-18 em vez de 0 para
-- qualquer `d > 0`.
--
-- A conta: com `p̂ = 0`, o numerador do limite inferior de Wilson e
-- `z²/(2n) - z·√( (0·(1-0) + z²/(4n²)) / n )`, que simplifica para
-- `z²/(2n) - z²/(2n)` — exatamente zero. O residuo aparece porque `SQRT` em
-- `numeric` arredonda, e a subtracao de dois valores quase iguais perde os
-- digitos significativos (cancelamento catastrofico).
--
-- Por que isso importa, e nao e cosmetico: o residuo ENCOLHE conforme `n`
-- cresce, entao a ordem entre comentarios sem upvote saia invertida. Medido em
-- producao em 2026-08-07:
--
--   (0,1)    -> -0.0000000000000000029468784610357694661782945062243021
--   (0,1000) -> -0.0000000000000000000077739884502656056009402217677322
--
-- `-2.9e-18 < -7.8e-21`, logo um comentario com UM downvote ordenava ABAIXO de
-- um com mil no sort `best` (`spec.md` 8c, padrao de abertura da conversa).
--
-- `GREATEST(..., 0)` zera o residuo e nao toca nenhum caso valido: o limite
-- inferior de Wilson e uma probabilidade, nunca legitimamente negativo.
-- Verificado antes de escrever esta migration — `(3,1)` continua
-- `0.4325414503689864693780673158507718692420314295228099`, identico ao valor
-- anterior.
--
-- ## Por que substituir a funcao em vez de criar `_v2`
--
-- `algorithm_version` existe para versionar MUDANCA DE ALGORITMO (decisao 7:
-- "algoritmo futuro cria nova versao e nova serie de score; nunca reinterpreta
-- historico silenciosamente"). Isto nao e algoritmo novo — e a mesma formula
-- devolvendo o valor que sempre deveria ter devolvido. Criar
-- `reddit-wilson-80-v2` faria a spec afirmar que a ordenacao mudou de criterio,
-- quando ela so parou de carregar ruido de arredondamento.
--
-- A substituicao e segura porque `community_comment_score_version` tem ZERO
-- linhas (medido em 2026-08-07): nao existe `best_score` gravado para
-- reinterpretar. `CREATE OR REPLACE` sobre coluna `GENERATED ... STORED` nao
-- recalcula linhas ja existentes — se houvesse dado, esta migration precisaria
-- de um `UPDATE` de backfill, e a decisao sobre historico seria outra.

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
  SELECT GREATEST(
    CASE
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
    END,
    0::NUMERIC
  );
$$;
