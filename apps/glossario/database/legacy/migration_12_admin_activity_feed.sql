BEGIN;

-- Índices de apoio para timeline administrativa.
CREATE INDEX IF NOT EXISTS idx_terms_created_at
  ON public.terms (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_term_comments_created_at
  ON public.term_comments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_term_votes_created_at
  ON public.term_votes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_term_history_changed_at
  ON public.term_history (changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_term_history_term_changed_at
  ON public.term_history (term_id, changed_at DESC);

DROP VIEW IF EXISTS public.admin_activity_feed;

CREATE VIEW public.admin_activity_feed AS
WITH history_grouped AS (
  SELECT
    h.term_id,
    h.changed_by,
    h.changed_at,
    bool_or(h.field = 'status') AS has_status_change,
    array_agg(DISTINCT h.field) AS changed_fields
  FROM public.term_history h
  GROUP BY h.term_id, h.changed_by, h.changed_at
),
history_first AS (
  SELECT DISTINCT ON (h.term_id, h.changed_by, h.changed_at)
    h.id,
    h.term_id,
    h.changed_by,
    h.changed_at
  FROM public.term_history h
  ORDER BY h.term_id, h.changed_by, h.changed_at, h.id
)
SELECT
  ('term:' || t.id::text) AS event_id,
  CASE
    WHEN t.nucleus = 'sugestao' AND t.status = 'pendente' THEN 'term.suggested'
    ELSE 'term.created'
  END AS event_type,
  'term'::text AS entity_type,
  t.id AS entity_id,
  t.id AS term_id,
  t.added_by AS actor_id,
  actor.full_name AS actor_name,
  actor.username AS actor_username,
  t.added_by AS target_user_id,
  actor.full_name AS target_user_name,
  actor.username AS target_username,
  COALESCE(actor.full_name, actor.username, 'Sistema') || ' criou o termo "' || t.name_en || '"' AS summary,
  jsonb_build_object(
    'termName', t.name_en,
    'status', t.status,
    'nucleus', t.nucleus,
    'sourceType', t.source_type
  ) AS payload,
  t.created_at
FROM public.terms t
LEFT JOIN public.users actor ON actor.id = t.added_by

UNION ALL

SELECT
  ('comment:' || c.id::text) AS event_id,
  'comment.create'::text AS event_type,
  'comment'::text AS entity_type,
  c.id AS entity_id,
  c.term_id,
  c.user_id AS actor_id,
  actor.full_name AS actor_name,
  actor.username AS actor_username,
  t.added_by AS target_user_id,
  target.full_name AS target_user_name,
  target.username AS target_username,
  COALESCE(actor.full_name, actor.username, 'Sistema') || ' comentou no termo "' || t.name_en || '"' AS summary,
  jsonb_build_object(
    'termName', t.name_en,
    'excerpt', left(c.body, 160),
    'deleted', c.deleted
  ) AS payload,
  c.created_at
FROM public.term_comments c
JOIN public.terms t ON t.id = c.term_id
LEFT JOIN public.users actor ON actor.id = c.user_id
LEFT JOIN public.users target ON target.id = t.added_by

UNION ALL

SELECT
  ('vote:' || v.id::text) AS event_id,
  CASE WHEN v.direction = 'up' THEN 'vote.up' ELSE 'vote.down' END AS event_type,
  'vote'::text AS entity_type,
  v.id AS entity_id,
  v.term_id,
  v.user_id AS actor_id,
  actor.full_name AS actor_name,
  actor.username AS actor_username,
  t.added_by AS target_user_id,
  target.full_name AS target_user_name,
  target.username AS target_username,
  COALESCE(actor.full_name, actor.username, 'Sistema') || ' votou no termo "' || t.name_en || '"' AS summary,
  jsonb_build_object(
    'termName', t.name_en,
    'direction', v.direction
  ) AS payload,
  v.created_at
FROM public.term_votes v
JOIN public.terms t ON t.id = v.term_id
LEFT JOIN public.users actor ON actor.id = v.user_id
LEFT JOIN public.users target ON target.id = t.added_by

UNION ALL

SELECT
  ('history:' || hf.id::text) AS event_id,
  CASE WHEN hg.has_status_change THEN 'term.moderated' ELSE 'term.updated' END AS event_type,
  'term'::text AS entity_type,
  hf.term_id AS entity_id,
  hf.term_id,
  hf.changed_by AS actor_id,
  actor.full_name AS actor_name,
  actor.username AS actor_username,
  t.added_by AS target_user_id,
  target.full_name AS target_user_name,
  target.username AS target_username,
  COALESCE(actor.full_name, actor.username, 'Sistema') || ' atualizou o termo "' || t.name_en || '"' AS summary,
  jsonb_build_object(
    'termName', t.name_en,
    'changedFields', to_jsonb(hg.changed_fields),
    'hasStatusChange', hg.has_status_change
  ) AS payload,
  hf.changed_at AS created_at
FROM history_first hf
JOIN history_grouped hg
  ON hg.term_id = hf.term_id
 AND hg.changed_by IS NOT DISTINCT FROM hf.changed_by
 AND hg.changed_at = hf.changed_at
JOIN public.terms t ON t.id = hf.term_id
LEFT JOIN public.users actor ON actor.id = hf.changed_by
LEFT JOIN public.users target ON target.id = t.added_by

UNION ALL

SELECT
  ('audit:' || a.id::text) AS event_id,
  CASE WHEN a.action = 'term.override' THEN 'term.override' ELSE 'audit.event' END AS event_type,
  a.entity_type,
  a.entity_id,
  a.entity_id AS term_id,
  a.actor_id,
  actor.full_name AS actor_name,
  actor.username AS actor_username,
  CASE
    WHEN coalesce(a.meta->>'original_author_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (a.meta->>'original_author_id')::uuid
    ELSE NULL
  END AS target_user_id,
  target.full_name AS target_user_name,
  target.username AS target_username,
  COALESCE(actor.full_name, actor.username, 'Sistema') || ' executou ação "' || a.action || '"' AS summary,
  jsonb_build_object(
    'action', a.action,
    'environment', a.environment,
    'meta', coalesce(a.meta, '{}'::jsonb),
    'prevState', coalesce(a.prev_state, '{}'::jsonb),
    'nextState', coalesce(a.next_state, '{}'::jsonb)
  ) AS payload,
  a.occurred_at AS created_at
FROM public.audit_log a
LEFT JOIN public.users actor ON actor.id = a.actor_id
LEFT JOIN public.users target ON target.id = CASE
  WHEN coalesce(a.meta->>'original_author_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN (a.meta->>'original_author_id')::uuid
  ELSE NULL
END

UNION ALL

SELECT
  ('user:' || u.id::text) AS event_id,
  'user.registered'::text AS event_type,
  'user'::text AS entity_type,
  u.id AS entity_id,
  NULL::uuid AS term_id,
  u.id AS actor_id,
  u.full_name AS actor_name,
  u.username AS actor_username,
  u.id AS target_user_id,
  u.full_name AS target_user_name,
  u.username AS target_username,
  COALESCE(u.full_name, u.username, 'Usuário') || ' registrou-se na comunidade.' AS summary,
  jsonb_build_object(
    'fullName', u.full_name,
    'username', u.username,
    'email', u.email
  ) AS payload,
  u.created_at
FROM public.users u;

COMMIT;

