BEGIN;

-- ============================================================================
-- Backfill histórico de notificações da comunidade
-- Objetivo: popular user_notifications com eventos passados sem duplicar.
-- Estratégia: inserir apenas quando NOT EXISTS por (user_id, entity_type, entity_id).
-- ============================================================================

-- 1) Votos históricos
INSERT INTO public.user_notifications (
  user_id,
  actor_id,
  term_id,
  event_type,
  entity_type,
  entity_id,
  payload,
  created_at,
  read_at
)
SELECT
  t.added_by AS user_id,
  v.user_id AS actor_id,
  v.term_id,
  CASE v.direction
    WHEN 'up' THEN 'vote.up'
    ELSE 'vote.down'
  END AS event_type,
  'vote' AS entity_type,
  v.id AS entity_id,
  jsonb_build_object(
    'termName', t.name_en,
    'direction', v.direction,
    'source', 'backfill-m10'
  ) AS payload,
  v.created_at,
  v.created_at
FROM public.term_votes v
JOIN public.terms t ON t.id = v.term_id
WHERE t.added_by IS NOT NULL
  AND v.user_id IS NOT NULL
  AND t.added_by <> v.user_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_notifications n
    WHERE n.user_id = t.added_by
      AND n.entity_type = 'vote'
      AND n.entity_id = v.id
  );

-- 2) Comentários históricos
INSERT INTO public.user_notifications (
  user_id,
  actor_id,
  term_id,
  event_type,
  entity_type,
  entity_id,
  payload,
  created_at,
  read_at
)
SELECT
  t.added_by AS user_id,
  c.user_id AS actor_id,
  c.term_id,
  'comment.create' AS event_type,
  'comment' AS entity_type,
  c.id AS entity_id,
  jsonb_build_object(
    'termName', t.name_en,
    'excerpt', left(c.body, 160),
    'source', 'backfill-m10'
  ) AS payload,
  c.created_at,
  c.created_at
FROM public.term_comments c
JOIN public.terms t ON t.id = c.term_id
WHERE t.added_by IS NOT NULL
  AND c.user_id IS NOT NULL
  AND t.added_by <> c.user_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_notifications n
    WHERE n.user_id = t.added_by
      AND n.entity_type = 'comment'
      AND n.entity_id = c.id
  );

-- 3) Edições históricas (agrupadas por termo+autor+timestamp)
WITH history_groups AS (
  SELECT
    h.term_id,
    h.changed_by,
    h.changed_at,
    array_agg(DISTINCT h.field) AS changed_fields
  FROM public.term_history h
  WHERE h.changed_by IS NOT NULL
  GROUP BY h.term_id, h.changed_by, h.changed_at
),
history_first_ids AS (
  SELECT DISTINCT ON (h.term_id, h.changed_by, h.changed_at)
    h.id AS event_id,
    h.term_id,
    h.changed_by,
    h.changed_at
  FROM public.term_history h
  WHERE h.changed_by IS NOT NULL
  ORDER BY h.term_id, h.changed_by, h.changed_at, h.id
),
history_events AS (
  SELECT
    f.event_id,
    f.term_id,
    f.changed_by,
    f.changed_at,
    g.changed_fields
  FROM history_first_ids f
  JOIN history_groups g
    ON g.term_id = f.term_id
   AND g.changed_by = f.changed_by
   AND g.changed_at = f.changed_at
)
INSERT INTO public.user_notifications (
  user_id,
  actor_id,
  term_id,
  event_type,
  entity_type,
  entity_id,
  payload,
  created_at,
  read_at
)
SELECT
  t.added_by AS user_id,
  he.changed_by AS actor_id,
  he.term_id,
  'term.updated' AS event_type,
  'term' AS entity_type,
  he.event_id AS entity_id,
  jsonb_build_object(
    'termName', t.name_en,
    'changedFields', to_jsonb(he.changed_fields),
    'source', 'backfill-m10'
  ) AS payload,
  he.changed_at,
  he.changed_at
FROM history_events he
JOIN public.terms t ON t.id = he.term_id
WHERE t.added_by IS NOT NULL
  AND he.changed_by IS NOT NULL
  AND t.added_by <> he.changed_by
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_notifications n
    WHERE n.user_id = t.added_by
      AND n.entity_type = 'term'
      AND n.entity_id = he.event_id
  );

-- 4) Moderações históricas (snapshot atual da revisão por termo)
INSERT INTO public.user_notifications (
  user_id,
  actor_id,
  term_id,
  event_type,
  entity_type,
  entity_id,
  payload,
  created_at,
  read_at
)
SELECT
  t.added_by AS user_id,
  t.reviewed_by AS actor_id,
  t.id AS term_id,
  'term.moderated' AS event_type,
  'moderation' AS entity_type,
  t.id AS entity_id,
  jsonb_build_object(
    'termName', t.name_en,
    'status', t.status,
    'source', 'backfill-m10'
  ) AS payload,
  t.reviewed_at,
  t.reviewed_at
FROM public.terms t
WHERE t.added_by IS NOT NULL
  AND t.reviewed_by IS NOT NULL
  AND t.reviewed_at IS NOT NULL
  AND t.added_by <> t.reviewed_by
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_notifications n
    WHERE n.user_id = t.added_by
      AND n.entity_type = 'moderation'
      AND n.entity_id = t.id
  );

COMMIT;
