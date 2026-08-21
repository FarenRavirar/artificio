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
-- Estoque medido em producao (2026-08-20), consultando os valores distintos de
-- setting_styles na tabela tables: 98 valores distintos, em 52 mesas. A medicao
-- fica registrada aqui porque foi ela que definiu o escopo da regra (AGENTS.md
-- §Evidencia). Nao e SQL desativado — o Sonar sinalizou como "codigo comentado"
-- (review PR #280), e a frase foi reescrita em prosa para nao parecer executavel.

-- Espelha capitalizeSegment do pacote: ALL CAPS vira capitalizada, camelCase
-- preserva a maiuscula interna.
CREATE OR REPLACE FUNCTION public.normalize_style_segment(word text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $seg$
BEGIN
  -- `word IS NULL OR word = ''`, não só `word = ''`: com NULL a comparação devolve
  -- NULL, o IF não entra e o NULL seguiria propagando pelas linhas abaixo até virar
  -- elemento nulo no array. A função é pública e o Sonar apontou a comparação
  -- (review PR #280, sql/null-handling).
  IF word IS NULL OR word = '' THEN
    RETURN word;
  END IF;
  IF length(word) > 1 AND word = upper(word) AND word <> lower(word) THEN
    RETURN upper(substr(lower(word),1,1)) || substr(lower(word),2);
  END IF;
  RETURN upper(substr(word,1,1)) || substr(word,2);
END;
$seg$;

-- Espelha capitalizeWord: sigla composta por "&" ("D&D") tem cada segmento
-- normalizado por si. Tratando a string inteira, o ramo de ALL CAPS rebaixava o
-- resto — medido no TS: "D&D" -> "D&d". Limite conhecido, igual ao do pacote:
-- segmento ALL CAPS de 2+ letras segue rebaixado ("AD&D" -> "Ad&D"), porque e a
-- mesma regra de "SOBREVIVENCIA" -> "Sobrevivencia" e "RPG" -> "Rpg".
-- Achado real (review PR #280, coderabbit, inline).
CREATE OR REPLACE FUNCTION public.normalize_style_word(word text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $wrd$
DECLARE
  parts text[];
  out_parts text[] := '{}';
  k int;
BEGIN
  -- Mesmo motivo do guard em normalize_style_segment: `position()` sobre NULL
  -- devolve NULL e a comparacao nunca entra no IF (review PR #280, sql/null-handling).
  IF word IS NULL OR position('&' in word) = 0 THEN
    RETURN public.normalize_style_segment(word);
  END IF;
  parts := string_to_array(word, '&');
  FOR k IN 1..array_length(parts, 1) LOOP
    out_parts := array_append(out_parts, public.normalize_style_segment(parts[k]));
  END LOOP;
  RETURN array_to_string(out_parts, '&');
END;
$wrd$;

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
    -- `elem IS NULL OR elem = ''`: array de texto aceita elemento NULL, e o
    -- regexp_replace acima devolve NULL para entrada NULL — sem o guard o valor
    -- seguia adiante em vez de ser pulado (review PR #280, sql/null-handling).
    IF elem IS NULL OR elem = '' THEN
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
      -- Typo de acento ANTES do ramo de caixa alta, espelhando a ordem de
      -- normalizeSettingStyles (ACCENT_TYPOS é consultado antes de capitalizeWord).
      -- Depois do ELSIF de ALL CAPS, "POLITICA" virava "Politica" e nunca chegava
      -- à correção: o backfill deixava o valor fora da forma canônica e a escrita
      -- seguinte o alterava de novo, em desacordo com o contrato do pacote.
      -- Achado real (review PR #280, codex, P2).
      ELSIF lower_word = 'politica' THEN
        normalized_words := array_append(normalized_words, 'Política');
      ELSIF lower_word = 'politico' THEN
        normalized_words := array_append(normalized_words, 'Político');
      -- Capitalizacao (ALL CAPS, camelCase e sigla com "&") em normalize_style_word,
      -- que espelha capitalizeWord do pacote.
      ELSE
        normalized_words := array_append(normalized_words, public.normalize_style_word(word));
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
    WHERE x IS NOT NULL AND x <> ''
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
