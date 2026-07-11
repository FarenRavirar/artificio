import { Request, Response } from 'express';
import { db } from '../config/database';

const parseLimit = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(100, Math.floor(n));
};

const parseOffset = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const EVENT_TYPES = new Set([
  'term.suggested',
  'term.created',
  'comment.create',
  'vote.up',
  'vote.down',
  'term.updated',
  'term.moderated',
  'term.override',
  'user.registered',
]);

const isMissingAdminActivityView = (err: unknown): boolean => {
  const pgErr = err as { code?: string; message?: string };
  return pgErr?.code === '42P01'
    && typeof pgErr?.message === 'string'
    && pgErr.message.includes('admin_activity_feed');
};

export const listAdminActivity = async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);
  const eventType = normalizeText(req.query.event_type);
  const actorId = normalizeText(req.query.actor_id);
  const targetUserId = normalizeText(req.query.target_user_id);
  const dateFrom = normalizeText(req.query.date_from);
  const dateTo = normalizeText(req.query.date_to);
  const search = normalizeText(req.query.q);

  try {
    const filters: string[] = [];
    const params: unknown[] = [];

    if (eventType && EVENT_TYPES.has(eventType)) {
      params.push(eventType);
      filters.push(`f.event_type = $${params.length}`);
    }

    if (actorId) {
      params.push(actorId);
      filters.push(`f.actor_id = $${params.length}::uuid`);
    }

    if (targetUserId) {
      params.push(targetUserId);
      filters.push(`f.target_user_id = $${params.length}::uuid`);
    }

    if (dateFrom) {
      params.push(dateFrom);
      filters.push(`f.created_at >= $${params.length}::timestamptz`);
    }

    if (dateTo) {
      params.push(dateTo);
      filters.push(`f.created_at <= $${params.length}::timestamptz`);
    }

    if (search) {
      params.push(`%${search}%`);
      filters.push(`(
        COALESCE(f.summary, '') ILIKE $${params.length}
        OR COALESCE(f.actor_name, '') ILIKE $${params.length}
        OR COALESCE(f.actor_username, '') ILIKE $${params.length}
        OR COALESCE(f.target_user_name, '') ILIKE $${params.length}
        OR COALESCE(f.target_username, '') ILIKE $${params.length}
        OR COALESCE(f.payload->>'termName', '') ILIKE $${params.length}
      )`);
    }

    const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const paramsWithPagination = [...params, limit, offset];

    const queryItems = `
      SELECT
        f.event_id,
        f.event_type,
        f.entity_type,
        f.entity_id,
        f.term_id,
        f.actor_id,
        f.actor_name,
        f.actor_username,
        f.target_user_id,
        f.target_user_name,
        f.target_username,
        f.summary,
        f.payload,
        f.created_at
      FROM public.admin_activity_feed f
      ${whereSql}
      ORDER BY f.created_at DESC
      LIMIT $${paramsWithPagination.length - 1}
      OFFSET $${paramsWithPagination.length}
    `;

    const queryCount = `
      SELECT COUNT(*)::int AS total_count
      FROM public.admin_activity_feed f
      ${whereSql}
    `;

    const [itemsResult, countResult] = await Promise.all([
      db.query(queryItems, paramsWithPagination),
      db.query(queryCount, params),
    ]);

    return res.status(200).json({
      total_count: countResult.rows[0]?.total_count ?? 0,
      items: itemsResult.rows,
    });
  } catch (err) {
    if (isMissingAdminActivityView(err)) {
      return res.status(503).json({
        message: 'Painel de atividade indisponível. A migration da visão admin_activity_feed ainda não foi aplicada neste ambiente.',
      });
    }
    console.error('[adminActivity] Erro ao listar atividade administrativa:', err);
    return res.status(500).json({ message: 'Erro ao carregar atividade administrativa.' });
  }
};
