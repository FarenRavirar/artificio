-- @class: online-safe
-- @requires-backup: false
-- @author: spec-089
-- @created: 2026-07-30
-- @description: Corrige criterio de consolidacao de denuncia duplicada e marca a linha consolidada.

-- Corrige DOIS defeitos da migration 036, ambos achados do Codex na PR #231
-- depois que a 036 ja havia sido aplicada em beta (consolidou 0 linhas la, sem
-- dano; downloads nunca foi a prod). Migration aplicada nunca se reescreve —
-- por isso a correcao vem aqui, e nao editando a 036.
--
-- Defeito 1 (P1) — criterio de sobrevivencia ignorava urgencia. A 036 escolhia
-- o sobrevivente so por `(created_at, id)`, entao a duplicata mais NOVA sempre
-- era dispensada. Quando a antiga esta `open`/P3 e a nova ja foi triada para
-- `in_review`/P0, a 036 descartava justamente a que carregava o trabalho de
-- moderacao e a urgencia real; como `GET /reports` lista apenas open/in_review,
-- prioridade e detalhes sumiam da fila. Aqui o sobrevivente e escolhido por
-- avanco de estado, depois urgencia, e so entao antiguidade como desempate.
--
-- Defeito 2 (P2) — consolidacao contaminava a deteccao de abuso. A 036 gravava
-- a nota de consolidacao com COALESCE, preservando nota de triagem preexistente
-- — logo uma linha podia virar `dismissed` SEM marcador nenhum. Os dois leitores
-- de abuso (POST /reports e GET /reports/abuse-check) contam `dismissed` como
-- denuncia improcedente, entao um denunciante com 3+ duplicatas abertas seria
-- sinalizado como abusivo por duplicatas que o proprio backend permitia criar
-- (ate 03578da o handler nao checava duplicata alguma). Marcador em coluna
-- dedicada, nao em texto: `resolution_note` e livre e ja carrega dois
-- significados (triagem humana e retirada voluntaria); um terceiro dependente de
-- LIKE quebraria no primeiro moderador que reescrevesse a nota.
ALTER TABLE download_report
  ADD COLUMN IF NOT EXISTS consolidated_into_report_id UUID NULL
    REFERENCES download_report(id) ON DELETE SET NULL;

COMMENT ON COLUMN download_report.consolidated_into_report_id IS
  'Preenchido quando a linha foi dispensada por consolidacao de duplicata (nao por decisao de moderacao). Leitores de abuso devem excluir estas linhas.';

CREATE INDEX IF NOT EXISTS idx_download_report_consolidated
  ON download_report(consolidated_into_report_id)
  WHERE consolidated_into_report_id IS NOT NULL;

-- Reabre o que a 036 consolidou pelo criterio errado, para reavaliar abaixo.
-- Identifica pela nota exata que a 036 gravou (unica marca disponivel naquele
-- momento). Restringe a linhas ainda sem marcador de consolidacao, para nunca
-- tocar caso decidido de verdade por um moderador.
UPDATE download_report
SET case_state = 'open',
    resolved_at = NULL,
    resolution_note = NULL
WHERE case_state = 'dismissed'
  AND consolidated_into_report_id IS NULL
  AND resolution_note = 'Consolidada na denuncia anterior do mesmo denunciante sobre o mesmo alvo (migration 036).';

-- Consolidacao correta: por alvo e denunciante, sobrevive o caso mais avancado
-- (in_review antes de open), depois o mais urgente (P0 antes de P3), e so entao
-- o mais antigo. As demais viram `dismissed` COM ponteiro para o sobrevivente,
-- preservando prioridade, categoria, detalhes e trilha de todas as linhas.
WITH ranqueado AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY reporter_user_id, material_id
           ORDER BY CASE case_state WHEN 'in_review' THEN 0 ELSE 1 END,
                    priority,
                    created_at,
                    id
         ) AS sobrevivente_id
  FROM download_report
  WHERE case_state IN ('open', 'in_review')
    AND reporter_user_id IS NOT NULL
    AND material_id IS NOT NULL
)
UPDATE download_report AS duplicata
SET case_state = 'dismissed',
    resolved_at = NOW(),
    resolution_note = 'Consolidada na denuncia do mesmo denunciante sobre o mesmo alvo que seguiu em analise.',
    consolidated_into_report_id = ranqueado.sobrevivente_id
FROM ranqueado
WHERE duplicata.id = ranqueado.id
  AND ranqueado.id <> ranqueado.sobrevivente_id;

WITH ranqueado AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY reporter_user_id, comment_id
           ORDER BY CASE case_state WHEN 'in_review' THEN 0 ELSE 1 END,
                    priority,
                    created_at,
                    id
         ) AS sobrevivente_id
  FROM download_report
  WHERE case_state IN ('open', 'in_review')
    AND reporter_user_id IS NOT NULL
    AND comment_id IS NOT NULL
)
UPDATE download_report AS duplicata
SET case_state = 'dismissed',
    resolved_at = NOW(),
    resolution_note = 'Consolidada na denuncia do mesmo denunciante sobre o mesmo alvo que seguiu em analise.',
    consolidated_into_report_id = ranqueado.sobrevivente_id
FROM ranqueado
WHERE duplicata.id = ranqueado.id
  AND ranqueado.id <> ranqueado.sobrevivente_id;
