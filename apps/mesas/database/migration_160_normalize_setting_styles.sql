-- @class: online-safe
-- @requires-backup: false
-- @author: spec-093
-- @created: 2026-08-20
-- @description: normaliza setting_styles do estoque (R20) — capitalização, preposição, pontuação, menções de role e typos de acento

-- R20 (spec 093): normaliza o estoque de setting_styles para a forma canônica
-- de normalizeSettingStyles (packages/catalog-matching). Diferente da migration_152
-- (lista fixa de 9 casos), esta aplica REGRA GENÉRICA sobre todos os valores,
-- espelhando a MESMA função usada na escrita (backend e frontend):
--   * trim de pontuação/símbolo;
--   * capitaliza a 1ª letra de cada palavra PRESERVANDO maiúscula interna
--     (camelCase "MegaDungeon" fica; o initcap achatava para "Megadungeon");
--   * rebaixa preposição interna em pt e en ("Fatia de Vida", "Slice of Life");
--   * normaliza ALL CAPS ("SOBREVIVENCIA" -> "Sobrevivencia");
--   * remove menção crua de role/usuário/canal ("<@&...>");
--   * typos de acento ("Politica" -> "Política").
--
-- Medido (SELECT DISTINCT unnest(setting_styles) FROM tables, 2026-08-20): 98 valores
-- distintos em 52 mesas.

CREATE OR REPLACE FUNCTION public.normalize_setting_styles(styles text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  result text[] := '{}';
  elem text;
  words text[];
  normalized_words text[];
  word text;
  lower_word text;
  i int;
  j int;
BEGIN
  FOR i IN 1..coalesce(array_length(styles, 1), 0) LOOP
    -- remove menção crua de role/usuário/canal do Discord (não resolvida)
    elem := regexp_replace(styles[i], '<[@#][!&]?\d+>', '', 'g');
    -- trim de pontuação/símbolo no início e fim
    elem := regexp_replace(elem, '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g');
    IF elem = '' THEN
      CONTINUE;
    END IF;
    words := regexp_split_to_array(elem, '\s+');
    normalized_words := '{}';
    FOR j IN 1..array_length(words, 1) LOOP
      word := words[j];
      lower_word := lower(word);
      -- preposição interna (pt + en) em minúsculo
      IF j > 1 AND lower_word = ANY(ARRAY['a', 'as', 'o', 'os', 'ao', 'aos', 'à', 'às', 'de', 'da', 'do', 'das', 'dos', 'dum', 'duma', 'duns', 'dumas', 'em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'nuns', 'numas', 'com', 'por', 'para', 'per', 'sem', 'sob', 'sobre', 'entre', 'até', 'após', 'desde', 'contra', 'ante', 'perante', 'trás', 'e', 'ou', 'nem', 'mas', 'pelo', 'pela', 'pelos', 'pelas', 'of', 'and', 'the', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from']) THEN
        normalized_words := array_append(normalized_words, lower_word);
      -- ALL CAPS -> capitalizada (ex.: "SOBREVIVENCIA" -> "Sobrevivencia")
      ELSIF length(word) > 1 AND word = upper(word) AND word <> lower_word THEN
        normalized_words := array_append(normalized_words, upper(substr(lower_word,1,1)) || substr(lower_word,2));
      -- capitaliza 1ª letra preservando maiúscula interna (camelCase)
      ELSE
        word := upper(substr(word,1,1)) || substr(word,2);
        IF lower_word = 'politica' THEN word := 'Política'; END IF;
        IF lower_word = 'politico' THEN word := 'Político'; END IF;
        normalized_words := array_append(normalized_words, word);
      END IF;
    END LOOP;
    result := array_append(result, array_to_string(normalized_words, ' '));
  END LOOP;
  -- Dedup preservando a ORDEM DE PRIMEIRA OCORRÊNCIA, espelhando o `[...new Set()]`
  -- de normalizeSettingStyles. A versão anterior usava `array_agg(DISTINCT x ORDER BY x)`,
  -- que reordenava alfabeticamente: o backfill embaralhava a ordem que o mestre digitou
  -- e a escrita seguinte a devolvia, produzindo UPDATE perpétuo entre os dois caminhos.
  -- Achado real (review PR #280, coderabbit, inline).
  SELECT array_agg(x ORDER BY first_pos) INTO result
  FROM (
    SELECT x, MIN(ord) AS first_pos
    FROM unnest(result) WITH ORDINALITY AS t(x, ord)
    WHERE x <> ''
    GROUP BY x
  ) AS deduped;
  -- Sem valor válido devolve NULL, como o normalizador do TS — `'{}'` faria o
  -- `IS DISTINCT FROM` do UPDATE trocar NULL por array vazio, que são estados
  -- diferentes para o chamador ("campo não enviado" vs "campo limpo").
  RETURN result;
END;
$func$;

UPDATE tables
SET setting_styles = public.normalize_setting_styles(setting_styles),
    updated_at = NOW()
WHERE setting_styles IS NOT NULL
  AND public.normalize_setting_styles(setting_styles) IS DISTINCT FROM setting_styles;
