BEGIN;

ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_event_type_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_event_type_check
  CHECK (
    event_type IN (
      'vote.up',
      'vote.down',
      'comment.create',
      'term.updated',
      'term.moderated',
      'user.registered'
    )
  );

ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_entity_type_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_entity_type_check
  CHECK (
    entity_type IN (
      'vote',
      'comment',
      'term',
      'moderation',
      'user'
    )
  );

COMMIT;

