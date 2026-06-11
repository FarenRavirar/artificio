BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  term_id     UUID REFERENCES public.terms(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_event_type_check
    CHECK (event_type IN ('vote.up', 'vote.down', 'comment.create', 'term.updated', 'term.moderated', 'user.registered')),
  CONSTRAINT user_notifications_entity_type_check
    CHECK (entity_type IN ('vote', 'comment', 'term', 'moderation', 'user'))
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_user_notifications_term
  ON public.user_notifications (term_id);

COMMIT;
