import { db } from '../config/database';

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

type VoteDirection = 'up' | 'down';

type NotificationEventType =
  | 'vote.up'
  | 'vote.down'
  | 'comment.create'
  | 'term.updated'
  | 'term.moderated'
  | 'user.registered';

type NotificationEntityType = 'vote' | 'comment' | 'term' | 'moderation' | 'user';

type NotifyPayload = {
  termName?: string | null;
  direction?: VoteDirection;
  status?: string | null;
  excerpt?: string | null;
  fullName?: string | null;
  username?: string | null;
};

const resolveExecutor = (executor?: QueryExecutor): QueryExecutor => executor ?? db;

const findTermOwner = async (
  termId: string,
  executor?: QueryExecutor
): Promise<{ ownerId: string | null; termName: string | null } | null> => {
  const client = resolveExecutor(executor);
  const result = await client.query(
    `SELECT added_by, name_en
       FROM public.terms
      WHERE id = $1
      LIMIT 1`,
    [termId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    ownerId: typeof row?.added_by === 'string' ? row.added_by : null,
    termName: typeof row?.name_en === 'string' ? row.name_en : null,
  };
};

const insertNotification = async (
  params: {
    userId: string;
    actorId: string | null;
    termId: string | null;
    eventType: NotificationEventType;
    entityType: NotificationEntityType;
    entityId: string | null;
    payload?: NotifyPayload;
  },
  executor?: QueryExecutor
): Promise<void> => {
  const client = resolveExecutor(executor);
  await client.query(
    `INSERT INTO public.user_notifications
      (user_id, actor_id, term_id, event_type, entity_type, entity_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      params.userId,
      params.actorId,
      params.termId,
      params.eventType,
      params.entityType,
      params.entityId,
      JSON.stringify(params.payload ?? {}),
    ]
  );
};

export const notifyTermOwnerOnVote = async (
  params: {
    termId: string;
    actorId: string;
    direction: VoteDirection;
  },
  executor?: QueryExecutor
): Promise<void> => {
  const term = await findTermOwner(params.termId, executor);
  if (!term?.ownerId || term.ownerId === params.actorId) return;

  await insertNotification(
    {
      userId: term.ownerId,
      actorId: params.actorId,
      termId: params.termId,
      eventType: params.direction === 'up' ? 'vote.up' : 'vote.down',
      entityType: 'vote',
      entityId: null,
      payload: {
        termName: term.termName,
        direction: params.direction,
      },
    },
    executor
  );
};

export const notifyTermOwnerOnComment = async (
  params: {
    termId: string;
    actorId: string;
    commentId: string;
    body: string;
  },
  executor?: QueryExecutor
): Promise<void> => {
  const term = await findTermOwner(params.termId, executor);
  if (!term?.ownerId || term.ownerId === params.actorId) return;

  await insertNotification(
    {
      userId: term.ownerId,
      actorId: params.actorId,
      termId: params.termId,
      eventType: 'comment.create',
      entityType: 'comment',
      entityId: params.commentId,
      payload: {
        termName: term.termName,
        excerpt: params.body.slice(0, 160),
      },
    },
    executor
  );
};

export const notifyTermOwnerOnModeration = async (
  params: {
    termId: string;
    actorId: string;
    status: string | null;
    eventType: 'term.updated' | 'term.moderated';
  },
  executor?: QueryExecutor
): Promise<void> => {
  const term = await findTermOwner(params.termId, executor);
  if (!term?.ownerId || term.ownerId === params.actorId) return;

  await insertNotification(
    {
      userId: term.ownerId,
      actorId: params.actorId,
      termId: params.termId,
      eventType: params.eventType,
      entityType: params.eventType === 'term.moderated' ? 'moderation' : 'term',
      entityId: params.termId,
      payload: {
        termName: term.termName,
        status: params.status,
      },
    },
    executor
  );
};

export const notifyAdminsOnUserRegistration = async (
  params: {
    newUserId: string;
    fullName: string | null;
    username: string | null;
  },
  executor?: QueryExecutor
): Promise<void> => {
  const client = resolveExecutor(executor);
  const admins = await client.query(
    `SELECT id
       FROM public.users
      WHERE role = 'admin'
        AND id <> $1`,
    [params.newUserId]
  );

  for (const admin of admins.rows) {
    await insertNotification(
      {
        userId: String(admin.id),
        actorId: params.newUserId,
        termId: null,
        eventType: 'user.registered',
        entityType: 'user',
        entityId: params.newUserId,
        payload: {
          fullName: params.fullName,
          username: params.username,
        },
      },
      client
    );
  }
};
