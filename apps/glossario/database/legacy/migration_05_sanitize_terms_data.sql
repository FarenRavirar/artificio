-- =============================================================================
-- MIGRATION 05 — Sanitização dos dados existentes no banco
-- Lote: sanitizacao-importacao
-- =============================================================================
-- Corrige registros importados com HTML entities corrompidas:
--   &amp;apos; → '    (ex: DEVIL&AMP;APOS;S RIDE → DEVIL'S RIDE)
--   &amp;      → &
--   &quot;     → "
--   &lt;       → <
--   &gt;       → >
--   &#39;      → '
--   &#34;      → "
--   \u0027     → '  (escape Unicode literal)
--   \u0026     → &
--
-- Executa 3 passagens em cada campo para resolver dupla/tripla codificação.
-- É idempotente: pode ser re-executado sem efeito colateral.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Função auxiliar: decode_html_entities(text) → text
-- Aplica as mesmas substituições do sanitizeText.ts do backend
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decode_html_entities(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text := input;
  prev   text;
  i      integer := 0;
BEGIN
  IF result IS NULL THEN RETURN NULL; END IF;

  -- Até 3 passagens para resolver múltiplos níveis de codificação
  LOOP
    prev := result;

    -- Sequências Unicode literais tipo \u0027
    result := regexp_replace(result, E'\\\\u0026', '&',  'gi');
    result := regexp_replace(result, E'\\\\u0027', '''', 'gi');
    result := regexp_replace(result, E'\\\\u003c', '<',  'gi');
    result := regexp_replace(result, E'\\\\u003e', '>',  'gi');
    result := regexp_replace(result, E'\\\\u0022', '"',  'gi');

    -- Entidades decimais &#NNN;
    result := regexp_replace(result, '&#39;',  '''', 'g');
    result := regexp_replace(result, '&#34;',  '"',  'g');
    result := regexp_replace(result, '&#38;',  '&',  'g');
    result := regexp_replace(result, '&#60;',  '<',  'g');
    result := regexp_replace(result, '&#62;',  '>',  'g');
    result := regexp_replace(result, '&#160;', ' ',  'g');

    -- Entidades nomeadas (case insensitive via ILIKE não disponível em replace; usar regexp)
    result := regexp_replace(result, '&amp;apos;', '''', 'gi');
    result := regexp_replace(result, '&amp;quot;', '"',  'gi');
    result := regexp_replace(result, '&amp;lt;',   '<',  'gi');
    result := regexp_replace(result, '&amp;gt;',   '>',  'gi');
    result := regexp_replace(result, '&amp;',      '&',  'gi');
    result := regexp_replace(result, '&apos;',     '''', 'gi');
    result := regexp_replace(result, '&quot;',     '"',  'gi');
    result := regexp_replace(result, '&lt;',       '<',  'gi');
    result := regexp_replace(result, '&gt;',       '>',  'gi');
    result := regexp_replace(result, '&nbsp;',     ' ',  'gi');

    i := i + 1;
    EXIT WHEN result = prev OR i >= 3;
  END LOOP;

  -- Normaliza espaços múltiplos em campos inline
  result := regexp_replace(trim(result), '\s+', ' ', 'g');

  RETURN result;
END;
$$;

-- -----------------------------------------------------------------------------
-- Aplicar nos campos de texto dos termos existentes
-- -----------------------------------------------------------------------------

UPDATE public.terms
SET
  name_en        = public.decode_html_entities(name_en),
  name_pt        = public.decode_html_entities(name_pt),
  book_reference = public.decode_html_entities(book_reference),
  page_reference = public.decode_html_entities(page_reference),
  additional_info = public.decode_html_entities(additional_info)
WHERE
  -- Só atualiza registros que realmente contêm entidades (evita writes desnecessários)
  name_en        ~ '&[a-zA-Z#0-9]+;|\\u[0-9a-fA-F]{4}'
  OR name_pt     ~ '&[a-zA-Z#0-9]+;|\\u[0-9a-fA-F]{4}'
  OR additional_info ~ '&[a-zA-Z#0-9]+;|\\u[0-9a-fA-F]{4}'
  OR book_reference  ~ '&[a-zA-Z#0-9]+;|\\u[0-9a-fA-F]{4}'
  OR page_reference  ~ '&[a-zA-Z#0-9]+;|\\u[0-9a-fA-F]{4}';

-- Relatório: quantos registros foram afetados
DO $$
BEGIN
  RAISE NOTICE 'Sanitização concluída. Registros processados pelo WHERE acima.';
END;
$$;

COMMIT;

-- Verificação pós-execução:
-- SELECT name_en FROM public.terms WHERE name_en LIKE '%&%' OR name_en LIKE '%\\u%' LIMIT 20;
