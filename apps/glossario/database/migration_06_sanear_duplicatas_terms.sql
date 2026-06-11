-- migration_06_sanear_duplicatas_terms.sql
-- Objetivo: eliminar duplicatas legadas antes da criação do índice único de deduplicação.
-- Regra de consolidação: manter o registro mais antigo (created_at ASC) por chave:
--   lower(trim(name_en)), system_id, scenario_id, nucleus
--
-- IMPORTANTE:
-- 1) Execute backup antes:
--    docker exec glossario-db pg_dump -U admin -d glossario_v2 > /tmp/pre_m06_$(date +%Y%m%d_%H%M).sql
-- 2) Rode o PASSO 1 e PASSO 2 e valide a contagem.
-- 3) Só então descomente o DELETE do PASSO 3.

BEGIN;

-- PASSO 1: grupos duplicados e ranking por antiguidade
WITH ranked AS (
  SELECT
    id,
    lower(trim(name_en)) AS name_en_key,
    system_id,
    scenario_id,
    nucleus,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(name_en)), system_id, scenario_id, nucleus
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.terms
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
-- PASSO 2: validar contagem de remoção antes de executar
SELECT COUNT(*) AS registros_a_remover FROM to_delete;

-- PASSO 3: remova o comentário somente após validar a contagem acima.
-- WITH ranked AS (
--   SELECT
--     id,
--     ROW_NUMBER() OVER (
--       PARTITION BY lower(trim(name_en)), system_id, scenario_id, nucleus
--       ORDER BY created_at ASC, id ASC
--     ) AS rn
--   FROM public.terms
-- )
-- DELETE FROM public.terms
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- PASSO 4: pós-validação (deve retornar 0 linhas após o DELETE)
SELECT
  lower(trim(name_en)) AS name_en_key,
  system_id,
  scenario_id,
  nucleus,
  COUNT(*) AS total
FROM public.terms
GROUP BY lower(trim(name_en)), system_id, scenario_id, nucleus
HAVING COUNT(*) > 1;

COMMIT;

