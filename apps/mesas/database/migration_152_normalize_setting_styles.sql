-- @class: online-safe
-- @requires-backup: false
-- @author: spec-081
-- @created: 2026-07-17
-- @description: Normaliza duplicatas/typos de setting_styles (T5.3 — auditoria visual identificou via SELECT em prod).

-- Achado real (SELECT DISTINCT unnest(setting_styles), 2026-07-17):
-- duplicatas por capitalização ("Dark Fantasy"/"dark fantasy"), pontuação solta
-- ("Exploração."/"Macabro.") e typos ("Saobrevivência", "Miastério"). Cada UPDATE
-- abaixo troca a variante suja pela forma canônica dentro do array, mantendo o
-- restante do array intacto (array_replace não duplica se a forma canônica já
-- existir no mesmo array — dedup final via array(select distinct unnest(...))).

UPDATE tables
SET setting_styles = (
  SELECT array_agg(DISTINCT style ORDER BY style)
  FROM unnest(
    array_replace(
    array_replace(
    array_replace(
    array_replace(
    array_replace(
    array_replace(
    array_replace(
    array_replace(
      setting_styles,
      'dark fantasy', 'Dark Fantasy'),
      'Exploração.', 'Exploração'),
      'fantasia', 'Fantasia'),
      'sobrevivência', 'Sobrevivência'),
      'Saobrevivência', 'Sobrevivência'),
      'suspense', 'Suspense'),
      'terror', 'Terror'),
      'Macabro.', 'Macabro')
  ) AS style
),
updated_at = NOW()
WHERE setting_styles IS NOT NULL
  AND setting_styles && ARRAY[
    'dark fantasy', 'Exploração.', 'fantasia', 'sobrevivência',
    'Saobrevivência', 'suspense', 'terror', 'Macabro.'
  ];

-- Typo isolado sem forma canônica ambígua: "Miastério" -> "Mistério".
-- Dedup via array_agg(DISTINCT ...) (achado Codex): sem isso, se "Mistério"
-- já existisse no mesmo array, array_replace geraria entrada duplicada.
UPDATE tables
SET setting_styles = (
  SELECT array_agg(DISTINCT style ORDER BY style)
  FROM unnest(
    array_replace(setting_styles, 'Miastério', 'Mistério')
  ) AS style
),
updated_at = NOW()
WHERE setting_styles IS NOT NULL
  AND 'Miastério' = ANY(setting_styles);
