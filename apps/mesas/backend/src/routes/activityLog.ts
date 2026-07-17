import { Router, Request, Response } from 'express';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(authRateLimiter);
router.use(authMiddleware, requireRole('admin'));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value: string): boolean => UUID_REGEX.test(value);

const parseIsoDate = (value: string): Date | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const normalizeMetadata = (input: unknown): Record<string, unknown> => {
  if (!input) {
    return {};
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  if (typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
};

const parseActionFilters = (rawAction: unknown): string[] => {
  if (Array.isArray(rawAction)) {
    return rawAction
      .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  if (typeof rawAction === 'string') {
    return rawAction
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
};

router.get('/activity', async (req: Request, res: Response) => {
  const actionFilters = parseActionFilters(req.query.action);
  const actorId = typeof req.query.actor_id === 'string' ? req.query.actor_id.trim() : null;
  const targetUserId = typeof req.query.target_user_id === 'string' ? req.query.target_user_id.trim() : null;
  const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type.trim() : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const dateFromRaw = typeof req.query.date_from === 'string' ? req.query.date_from : null;
  const dateToRaw = typeof req.query.date_to === 'string' ? req.query.date_to : null;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : null;

  const requestedLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN;
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 200)
    : 50;

  if (actorId && !isValidUuid(actorId)) {
    return res.status(400).json({ error: 'Parâmetro actor_id inválido.' });
  }

  if (targetUserId && !isValidUuid(targetUserId)) {
    return res.status(400).json({ error: 'Parâmetro target_user_id inválido.' });
  }

  if (cursor && !isValidUuid(cursor)) {
    return res.status(400).json({ error: 'Parâmetro cursor inválido.' });
  }

  const dateFrom = dateFromRaw ? parseIsoDate(dateFromRaw) : null;
  const dateTo = dateToRaw ? parseIsoDate(dateToRaw) : null;

  if (dateFromRaw && !dateFrom) {
    return res.status(400).json({ error: 'Parâmetro date_from inválido.' });
  }

  if (dateToRaw && !dateTo) {
    return res.status(400).json({ error: 'Parâmetro date_to inválido.' });
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return res.status(400).json({ error: 'Parâmetro date_from deve ser menor ou igual a date_to.' });
  }

  try {
    let cursorRow: { id: string; created_at: Date } | undefined;

    if (cursor) {
      cursorRow = await db
        .selectFrom('activity_log')
        .select(['id', 'created_at'])
        .where('id', '=', cursor)
        .executeTakeFirst() as { id: string; created_at: Date } | undefined;

      if (!cursorRow) {
        return res.status(400).json({ error: 'Cursor não encontrado.' });
      }
    }

    let query = db
      .selectFrom('activity_log as al')
      .leftJoin('users as actor_u', 'actor_u.id', 'al.actor_id')
      .leftJoin('profiles as actor_p', 'actor_p.user_id', 'actor_u.id')
      .leftJoin('users as target_u', 'target_u.id', 'al.target_user_id')
      .leftJoin('profiles as target_p', 'target_p.user_id', 'target_u.id')
      .select([
        'al.id',
        'al.action',
        'al.entity_type',
        'al.entity_id',
        'al.entity_label',
        'al.summary',
        'al.metadata',
        'al.created_at',
        'al.actor_role',
        'al.actor_id',
        'al.target_user_id',
        sql<string | null>`COALESCE(actor_p.display_name, actor_u.username)`.as('actor_name'),
        'actor_p.avatar_url as actor_avatar_url',
        sql<string | null>`COALESCE(target_p.display_name, target_u.username)`.as('target_name'),
        'target_p.avatar_url as target_avatar_url',
      ]);

    if (actionFilters.length > 0) {
      query = query.where('al.action', 'in', actionFilters);
    }

    if (actorId) {
      query = query.where('al.actor_id', '=', actorId);
    }

    if (targetUserId) {
      query = query.where('al.target_user_id', '=', targetUserId);
    }

    if (entityType) {
      query = query.where('al.entity_type', '=', entityType);
    }

    if (search) {
      query = query.where('al.summary', 'ilike', `%${search}%`);
    }

    if (dateFrom) {
      query = query.where('al.created_at', '>=', dateFrom);
    }

    if (dateTo) {
      query = query.where('al.created_at', '<=', dateTo);
    }

    if (cursorRow) {
      query = query.where((eb) =>
        eb.or([
          eb('al.created_at', '<', cursorRow!.created_at),
          eb.and([
            eb('al.created_at', '=', cursorRow!.created_at),
            eb('al.id', '<', cursorRow!.id),
          ]),
        ])
      );
    }

    const rows = await query
      .orderBy('al.created_at', 'desc')
      .orderBy('al.id', 'desc')
      .limit(limit + 1)
      .execute();

    let hasMore = false;
    if (rows.length > limit) {
      hasMore = true;
      rows.pop();
    }

    const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1].id : null;

    const [actors, targetUsers, availableActionsRows] = await Promise.all([
      db
        .selectFrom('users as u')
        .innerJoin('activity_log as al', 'al.actor_id', 'u.id')
        .leftJoin('profiles as p', 'p.user_id', 'u.id')
        .select([
          'u.id as id',
          sql<string>`COALESCE(p.display_name, u.username)`.as('name'),
          'p.avatar_url as avatar_url',
          'u.role as role',
        ])
        .groupBy(['u.id', 'p.display_name', 'u.username', 'p.avatar_url', 'u.role'])
        .orderBy('u.username', 'asc')
        .execute(),
      db
        .selectFrom('users as u')
        .innerJoin('activity_log as al', 'al.target_user_id', 'u.id')
        .leftJoin('profiles as p', 'p.user_id', 'u.id')
        .select([
          'u.id as id',
          sql<string>`COALESCE(p.display_name, u.username)`.as('name'),
          'p.avatar_url as avatar_url',
        ])
        .groupBy(['u.id', 'p.display_name', 'u.username', 'p.avatar_url'])
        .orderBy('u.username', 'asc')
        .execute(),
      db
        .selectFrom('activity_log')
        .select('action')
        .distinct()
        .orderBy('action', 'asc')
        .execute(),
    ]);

    const data = rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_label: row.entity_label,
      summary: row.summary,
      metadata: normalizeMetadata(row.metadata),
      created_at: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at as unknown as string).toISOString(),
      actor: row.actor_id
        ? {
            id: row.actor_id,
            name: row.actor_name ?? 'Usuário sem nome',
            avatar_url: row.actor_avatar_url,
            role: row.actor_role,
          }
        : null,
      target_user: row.target_user_id
        ? {
            id: row.target_user_id,
            name: row.target_name ?? 'Usuário sem nome',
            avatar_url: row.target_avatar_url,
          }
        : null,
    }));

    return res.json({
      data,
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
      },
      filters_meta: {
        actors: actors.map((actor) => ({
          id: actor.id,
          name: actor.name,
          avatar_url: actor.avatar_url,
          role: actor.role,
        })),
        target_users: targetUsers.map((target) => ({
          id: target.id,
          name: target.name,
          avatar_url: target.avatar_url,
        })),
        available_actions: availableActionsRows.map((row) => row.action),
      },
    });
  } catch (error) {
    console.error('[GET /admin/activity]', error);
    return res.status(500).json({ error: 'Erro ao buscar atividades administrativas.' });
  }
});

export default router;
