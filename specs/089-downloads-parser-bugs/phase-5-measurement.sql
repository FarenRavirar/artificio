\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;

-- Mede somente a run mais recente de cada fonte. A Fase 5 executa as três
-- sequencialmente após o TRUNCATE; misturar runs históricas falsificaria taxas.
WITH expected_sources(source_platform) AS (
  VALUES ('opera_rpg'), ('itch_io'), ('grimorios_e_dados')
), ranked_runs AS (
  SELECT r.*, row_number() OVER (
    PARTITION BY source_platform ORDER BY started_at DESC, id DESC
  ) AS position
  FROM download_scraper_run r
  WHERE source_platform IN ('opera_rpg', 'itch_io', 'grimorios_e_dados')
), selected_runs AS (
  SELECT
    e.source_platform,
    r.id,
    r.status,
    coalesce(r.items_found, 0) AS items_found,
    coalesce(r.items_created, 0) AS items_created,
    coalesce(r.items_skipped_duplicate, 0) AS items_skipped_duplicate,
    coalesce(r.items_skipped_not_portuguese, 0) AS items_skipped_not_portuguese,
    coalesce(r.items_skipped_error, 0) AS items_skipped_error,
    r.started_at,
    r.finished_at
  FROM expected_sources e
  LEFT JOIN ranked_runs r
    ON r.source_platform = e.source_platform AND r.position = 1
), run_items AS (
  SELECT
    r.source_platform,
    r.id AS run_id,
    r.status,
    r.items_found,
    r.items_created,
    r.items_skipped_duplicate,
    r.items_skipped_not_portuguese,
    r.items_skipped_error,
    r.started_at,
    r.finished_at,
    l.id AS log_id,
    l.source_url,
    l.outcome,
    l.detected_language,
    l.error_detail,
    l.system_hint,
    l.material_type_hint,
    CASE
      WHEN r.source_platform = 'opera_rpg'
        THEN coalesce(nullif(l.source_category, ''), 'template-ausente')
      ELSE 'produto'
    END AS template,
    m.id AS material_id,
    m.slug,
    m.title,
    m.summary,
    m.description,
    m.material_type,
    m.system_id,
    m.raw_system_hint,
    m.material_type_id,
    m.raw_material_type_hint,
    m.language_confident,
    md.scenario,
    md.credits,
    md.publisher_name,
    md.publisher_key,
    md.authors,
    md.author_keys,
    md.artists,
    md.artist_keys,
    md.file_size_text,
    md.file_format,
    md.creation_method,
    md.source_category,
    md.source_filters,
    md.tags
  FROM selected_runs r
  LEFT JOIN download_scraper_item_log l ON l.run_id = r.id
  LEFT JOIN download_material m ON m.id = l.material_id
  LEFT JOIN download_material_metadata md ON md.material_id = m.id
), template_metrics AS (
  SELECT
    source_platform,
    template,
    count(log_id) AS found,
    count(*) FILTER (WHERE outcome = 'created') AS created,
    count(*) FILTER (WHERE outcome IN ('skipped_not_portuguese', 'skipped_error')) AS rejected,
    count(*) FILTER (WHERE outcome = 'skipped_duplicate') AS duplicate,
    count(*) FILTER (WHERE outcome = 'skipped_error') AS errors,
    count(*) FILTER (WHERE system_hint IS NOT NULL) AS system_raw,
    count(*) FILTER (WHERE outcome = 'created' AND system_id IS NOT NULL) AS system_matched,
    count(*) FILTER (WHERE material_type_hint IS NOT NULL) AS type_raw,
    count(*) FILTER (
      WHERE outcome = 'created'
        AND material_type_hint IS NOT NULL
        AND raw_material_type_hint IS NULL
        AND lower(material_type) NOT IN ('nao classificado', 'não classificado', 'nao-classificado')
    ) AS type_matched,
    count(*) FILTER (
      WHERE outcome = 'created'
        AND lower(material_type) IN ('nao classificado', 'não classificado', 'nao-classificado')
    ) AS neutral
  FROM run_items
  GROUP BY source_platform, template
), opera_thresholds(template, min_system_rate, min_type_rate) AS (
  VALUES
    ('aventuras', 1.00::numeric, 1.00::numeric),
    ('cenarios', 0.95::numeric, 1.00::numeric),
    ('personagens', 1.00::numeric, NULL::numeric),
    ('personagens-digitais', 1.00::numeric, NULL::numeric),
    ('regras-e-fichas', 1.00::numeric, NULL::numeric),
    ('outros', 1.00::numeric, NULL::numeric)
), language_ground_truth(source_url, is_portuguese) AS (
  VALUES
    ('https://gontijo.itch.io/thetususmine', false),
    ('https://grimorios-e-dados.itch.io/machados-e-bruxarias', true),
    ('https://bibitenco.itch.io/you-will-never-be-a-dragon', false),
    ('https://arquivos.operarpg.com.br/aventuras/AOAsesFlp.pdf', true),
    ('https://arquivos.operarpg.com.br/cenarios/DB114-GaiaOpera.pdf', true),
    ('https://arquivos.operarpg.com.br/regras_e_fichas/RRacasDD.pdf', true),
    ('https://rafaarruda.itch.io/cairn-pt-br', true),
    ('https://grimorios-e-dados.itch.io/naraka-space', true),
    ('https://grimorios-e-dados.itch.io/o-horror-de-axaxilha', true),
    ('https://grimorios-e-dados.itch.io/the-iron-man-returns', false),
    ('https://deep-dark-games.itch.io/a-perfect-rock-one-page', false)
), language_evaluation AS (
  SELECT
    count(*) AS total,
    count(ri.log_id) AS observed,
    count(*) FILTER (
      WHERE gt.is_portuguese IS false AND ri.outcome = 'created'
    ) AS false_positives,
    count(*) FILTER (
      WHERE gt.is_portuguese IS true
        AND ri.outcome = 'created'
        AND ri.detected_language = 'por'
        AND ri.language_confident IS true
    ) AS portuguese_approved
  FROM language_ground_truth gt
  LEFT JOIN run_items ri ON ri.source_url = gt.source_url
), taxonomy_ground_truth(source_url, expected_system_hint, expected_type_hint) AS (
  VALUES
    ('https://bibitenco.itch.io/you-will-never-be-a-dragon', 'Dungeons & Dragons', 'Suplemento'),
    ('https://rafaarruda.itch.io/cairn-pt-br', 'Cairn', NULL::text),
    ('https://gontijo.itch.io/thetususmine', NULL::text, NULL::text),
    ('https://grimorios-e-dados.itch.io/machados-e-bruxarias', NULL::text, NULL::text)
), taxonomy_evaluation AS (
  SELECT
    count(*) AS total,
    count(ri.log_id) AS observed,
    count(*) FILTER (
      WHERE ri.system_hint IS NOT DISTINCT FROM gt.expected_system_hint
        AND ri.material_type_hint IS NOT DISTINCT FROM gt.expected_type_hint
    ) AS matched
  FROM taxonomy_ground_truth gt
  LEFT JOIN run_items ri ON ri.source_url = gt.source_url
), slug_ground_truth(source_url, expected_slug) AS (
  VALUES ('https://arquivos.operarpg.com.br/regras_e_fichas/RRacasDD.pdf', 'racas-d-d')
), slug_evaluation AS (
  SELECT count(*) AS total, count(ri.material_id) AS observed,
    count(*) FILTER (WHERE ri.slug = gt.expected_slug) AS matched
  FROM slug_ground_truth gt
  LEFT JOIN run_items ri ON ri.source_url = gt.source_url
), entity_evaluation AS (
  SELECT count(*) FILTER (
    WHERE concat_ws(' ', title, summary, description, raw_system_hint,
      raw_material_type_hint, scenario, credits, publisher_name,
      file_size_text, file_format, creation_method, source_category,
      array_to_string(authors, ' '), array_to_string(artists, ' '),
      tags::text, source_filters::text)
      ~ '&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);'
  ) AS failures,
  count(*) FILTER (WHERE outcome = 'created') AS total
  FROM run_items
), facet_shape_evaluation AS (
  SELECT count(*) FILTER (
    WHERE cardinality(authors) <> cardinality(author_keys)
      OR cardinality(artists) <> cardinality(artist_keys)
      OR (publisher_name IS NOT NULL AND publisher_key IS NULL)
  ) AS failures,
  count(*) FILTER (WHERE outcome = 'created') AS total
  FROM run_items
), rules AS (
  SELECT 'run:' || source_platform || ':completed' AS rule,
    CASE WHEN status = 'completed' AND finished_at IS NOT NULL THEN 'pass' ELSE 'fail' END AS verdict,
    CASE WHEN status = 'completed' AND finished_at IS NOT NULL THEN 1 ELSE 0 END::bigint AS matched,
    1::bigint AS total
  FROM selected_runs
  UNION ALL
  SELECT 'run:' || source_platform || ':found_positive',
    CASE WHEN items_found > 0 THEN 'pass' ELSE 'fail' END, items_found, items_found
  FROM selected_runs
  UNION ALL
  SELECT 'run:' || source_platform || ':created_positive',
    CASE WHEN items_created > 0 THEN 'pass' ELSE 'fail' END, items_created, items_found
  FROM selected_runs
  UNION ALL
  SELECT 'run:' || source_platform || ':zero_errors',
    CASE WHEN items_skipped_error = 0 THEN 'pass' ELSE 'fail' END,
    items_found - items_skipped_error, items_found
  FROM selected_runs
  UNION ALL
  SELECT 'run:' || source_platform || ':reconciled',
    CASE WHEN items_found = items_created + items_skipped_duplicate + items_skipped_not_portuguese + items_skipped_error THEN 'pass' ELSE 'fail' END,
    items_created + items_skipped_duplicate + items_skipped_not_portuguese + items_skipped_error, items_found
  FROM selected_runs
  UNION ALL
  SELECT 'opera_rpg:' || m.template || ':system_match',
    CASE WHEN m.system_matched::numeric / NULLIF(m.created, 0) >= t.min_system_rate THEN 'pass' ELSE 'fail' END,
    m.system_matched, m.created
  FROM template_metrics m
  JOIN opera_thresholds t ON t.template = m.template
  WHERE m.source_platform = 'opera_rpg'
  UNION ALL
  SELECT 'opera_rpg:' || m.template || ':type_match',
    CASE WHEN m.type_matched::numeric / NULLIF(m.type_raw, 0) >= t.min_type_rate THEN 'pass' ELSE 'fail' END,
    m.type_matched, m.type_raw
  FROM template_metrics m
  JOIN opera_thresholds t ON t.template = m.template
  WHERE m.source_platform = 'opera_rpg' AND t.min_type_rate IS NOT NULL
  UNION ALL
  SELECT 'language:ground_truth_observed',
    CASE WHEN observed = total THEN 'pass' ELSE 'fail' END, observed, total
  FROM language_evaluation
  UNION ALL
  SELECT 'language:false_positives',
    CASE WHEN false_positives = 0 THEN 'pass' ELSE 'fail' END,
    total - false_positives, total
  FROM language_evaluation
  UNION ALL
  SELECT 'taxonomy:fixture_ground_truth',
    CASE WHEN observed = total AND matched = total THEN 'pass' ELSE 'fail' END,
    matched, total
  FROM taxonomy_evaluation
  UNION ALL
  SELECT 'slug:fixture_ground_truth',
    CASE WHEN observed = total AND matched = total THEN 'pass' ELSE 'fail' END,
    matched, total
  FROM slug_evaluation
  UNION ALL
  SELECT 'catalog:neutral_type_minority',
    CASE WHEN count(*) FILTER (
      WHERE outcome = 'created' AND lower(material_type) IN ('nao classificado', 'não classificado', 'nao-classificado')
    )::numeric / NULLIF(count(*) FILTER (WHERE outcome = 'created'), 0) < 0.5 THEN 'pass' ELSE 'fail' END,
    count(*) FILTER (
      WHERE outcome = 'created' AND lower(material_type) NOT IN ('nao classificado', 'não classificado', 'nao-classificado')
    ),
    count(*) FILTER (WHERE outcome = 'created')
  FROM run_items
  UNION ALL
  SELECT 'plain_text:entities', CASE WHEN failures = 0 THEN 'pass' ELSE 'fail' END,
    total - failures, total FROM entity_evaluation
  UNION ALL
  SELECT 'facets:shape', CASE WHEN failures = 0 THEN 'pass' ELSE 'fail' END,
    total - failures, total FROM facet_shape_evaluation
)
SELECT
  'metric'::text AS row_kind,
  source_platform,
  template,
  NULL::text AS rule,
  NULL::text AS verdict,
  found,
  created,
  rejected,
  duplicate,
  errors,
  system_matched,
  system_raw,
  type_matched,
  type_raw,
  neutral,
  NULL::bigint AS matched,
  NULL::bigint AS total,
  NULL::numeric AS percentage
FROM template_metrics
UNION ALL
SELECT
  'rule',
  NULL,
  NULL,
  rule,
  verdict,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  matched,
  total,
  round(100.0 * matched / NULLIF(total, 0), 2)
FROM rules
ORDER BY row_kind, source_platform NULLS LAST, template NULLS LAST, rule NULLS LAST;

ROLLBACK;
