-- =============================================================================
-- GLOSSÁRIO ARTIFÍCIO RPG v2 — MIGRATION 02: Sanitização Definitiva de Entidades
-- =============================================================================
-- Objetivo:
-- Corrigir dados legados importados com encoding corrompido (ex.: \u0026amp;apos;,
-- &AMP, &#10;) diretamente na base PostgreSQL, removendo o problema na origem.
--
-- Escopo:
-- - public.terms
-- - public.term_sources
--
-- Segurança:
-- - Script idempotente (pode ser executado novamente sem dano)
-- - Altera apenas linhas com padrão suspeito de encoding legado

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_legacy_html_entities(input_text text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  current_text text;
  next_text text;
  pass integer := 0;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  current_text := input_text;

  LOOP
    pass := pass + 1;
    next_text := current_text;

    -- Sequências unicode escapadas comuns em import legado
    next_text := replace(next_text, '\\u0026', '&');
    next_text := replace(next_text, '\\u0027', '''');
    next_text := replace(next_text, '\\u0022', chr(34));
    next_text := replace(next_text, '\\u003c', '<');
    next_text := replace(next_text, '\\u003e', '>');
    next_text := replace(next_text, '\\u00a0', ' ');
    next_text := replace(next_text, '\\u000d', '');
    next_text := replace(next_text, '\\u000a', E'\n');

    -- Entidades nomeadas (com ou sem ';', case-insensitive)
    next_text := regexp_replace(next_text, '&amp;?', '&', 'gi');
    next_text := regexp_replace(next_text, '&apos;?', '''', 'gi');
    next_text := regexp_replace(next_text, '&quot;?', chr(34), 'gi');
    next_text := regexp_replace(next_text, '&lt;?', '<', 'gi');
    next_text := regexp_replace(next_text, '&gt;?', '>', 'gi');
    next_text := regexp_replace(next_text, '&nbsp;?', ' ', 'gi');

    -- Entidades numéricas decimais mais recorrentes
    next_text := regexp_replace(next_text, '&#0*38;?', '&', 'gi');
    next_text := regexp_replace(next_text, '&#0*39;?', '''', 'gi');
    next_text := regexp_replace(next_text, '&#0*34;?', chr(34), 'gi');
    next_text := regexp_replace(next_text, '&#0*60;?', '<', 'gi');
    next_text := regexp_replace(next_text, '&#0*62;?', '>', 'gi');
    next_text := regexp_replace(next_text, '&#0*160;?', ' ', 'gi');
    next_text := regexp_replace(next_text, '&#0*13;?', '', 'gi');
    next_text := regexp_replace(next_text, '&#0*10;?', E'\n', 'gi');

    EXIT WHEN next_text = current_text OR pass >= 5;
    current_text := next_text;
  END LOOP;

  RETURN next_text;
END;
$$;

-- -----------------------------------------------------------------------------
-- Sanitização da tabela central de termos
-- -----------------------------------------------------------------------------
WITH terms_normalized AS (
  SELECT
    t.id,
    public.normalize_legacy_html_entities(t.name_en)         AS new_name_en,
    public.normalize_legacy_html_entities(t.name_pt)         AS new_name_pt,
    public.normalize_legacy_html_entities(t.book_reference)  AS new_book_reference,
    public.normalize_legacy_html_entities(t.page_reference)  AS new_page_reference,
    public.normalize_legacy_html_entities(t.additional_info) AS new_additional_info
  FROM public.terms t
),
terms_updated AS (
  UPDATE public.terms t
     SET name_en         = n.new_name_en,
         name_pt         = n.new_name_pt,
         book_reference  = n.new_book_reference,
         page_reference  = n.new_page_reference,
         additional_info = n.new_additional_info
    FROM terms_normalized n
   WHERE n.id = t.id
     AND (
          n.new_name_en         IS DISTINCT FROM t.name_en
       OR n.new_name_pt         IS DISTINCT FROM t.name_pt
       OR n.new_book_reference  IS DISTINCT FROM t.book_reference
       OR n.new_page_reference  IS DISTINCT FROM t.page_reference
       OR n.new_additional_info IS DISTINCT FROM t.additional_info
     )
  RETURNING t.id
)
SELECT COUNT(*) AS termos_sanitizados FROM terms_updated;

-- -----------------------------------------------------------------------------
-- Sanitização de fontes vinculadas
-- -----------------------------------------------------------------------------
WITH sources_normalized AS (
  SELECT
    s.id,
    public.normalize_legacy_html_entities(s.book_reference) AS new_book_reference,
    public.normalize_legacy_html_entities(s.page_reference) AS new_page_reference,
    public.normalize_legacy_html_entities(s.notes)          AS new_notes
  FROM public.term_sources s
),
source_updated AS (
  UPDATE public.term_sources s
     SET book_reference = n.new_book_reference,
         page_reference = n.new_page_reference,
         notes          = n.new_notes
    FROM sources_normalized n
   WHERE n.id = s.id
     AND (
          n.new_book_reference IS DISTINCT FROM s.book_reference
       OR n.new_page_reference IS DISTINCT FROM s.page_reference
       OR n.new_notes          IS DISTINCT FROM s.notes
     )
  RETURNING s.id
)
SELECT COUNT(*) AS fontes_sanitizadas FROM source_updated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificação pós-rodagem (deve retornar 0 para ambos)
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS termos_ainda_nao_normalizados
FROM public.terms t
WHERE public.normalize_legacy_html_entities(t.name_en)         IS DISTINCT FROM t.name_en
   OR public.normalize_legacy_html_entities(t.name_pt)         IS DISTINCT FROM t.name_pt
   OR public.normalize_legacy_html_entities(t.book_reference)  IS DISTINCT FROM t.book_reference
   OR public.normalize_legacy_html_entities(t.page_reference)  IS DISTINCT FROM t.page_reference
   OR public.normalize_legacy_html_entities(t.additional_info) IS DISTINCT FROM t.additional_info;

SELECT COUNT(*) AS fontes_ainda_nao_normalizadas
FROM public.term_sources s
WHERE public.normalize_legacy_html_entities(s.book_reference) IS DISTINCT FROM s.book_reference
   OR public.normalize_legacy_html_entities(s.page_reference) IS DISTINCT FROM s.page_reference
   OR public.normalize_legacy_html_entities(s.notes)          IS DISTINCT FROM s.notes;
