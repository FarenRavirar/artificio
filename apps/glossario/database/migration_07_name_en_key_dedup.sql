-- migration_07_name_en_key_dedup.sql
-- Objetivo: adicionar chave normalizada e índice único de deduplicação.
-- Pré-requisito: migration_06_sanear_duplicatas_terms.sql aplicada e validada.

BEGIN;

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS name_en_key TEXT GENERATED ALWAYS AS (
    lower(trim(name_en))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_terms_name_en_key_trgm
  ON public.terms USING gin (name_en_key gin_trgm_ops);

-- Hard delete já elimina registros removidos.
-- A expressão abaixo cobre cenários e sistemas em uma única chave:
-- scenario_id quando existir; senão system_id; senão fallback "global".
CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_dedup
  ON public.terms (
    name_en_key,
    nucleus,
    COALESCE(scenario_id::text, system_id::text, 'global')
  );

COMMIT;

