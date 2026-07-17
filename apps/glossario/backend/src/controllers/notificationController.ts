import { Response } from 'express';
import { db } from '../config/database.js';
import type { AuthedRequest } from '../types/express.js';

const parseLimit = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(100, Math.floor(n));
};

const parseOffset = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

const EVENT_TYPES = new Set([
  'vote.up',
  'vote.down',
  'comment.create',
  'term.updated',
  'term.moderated',
  'user.registered',
]);

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const isMissingNotificationsTable = (err: unknown): boolean => {
  const pgErr = err as { code?: string; message?: string };
  return pgErr?.code === '42P01'
    && typeof pgErr?.message === 'string'
    && pgErr.message.includes('user_notifications');
};

type ListNotificationsFilters = {
  scopeAll: boolean;
  userId: string;
  targetUserId: string | null;
  unreadOnly: boolean;
  readOnly: boolean;
  eventType: string | null;
  actorId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
};

// Achado Sonar (PR #145): listNotifications tinha complexidade cognitiva 18
// (montagem de filtros dinamicos com 8 condicionais, tudo no corpo do handler).
// Extraido para reduzir aninhamento no handler.
function buildListNotificationsFilters(opts: ListNotificationsFilters): { whereSql: string; params: unknown[] } {
  const { scopeAll, userId, targetUserId, unreadOnly, readOnly, eventType, actorId, dateFrom, dateTo, search } = opts;
  const filters: string[] = [];
  const params: unknown[] = [];

  if (scopeAll) {
    if (targetUserId) {
      params.push(targetUserId);
      filters.push(`n.user_id = $${params.length}`);
    }
  } else {
    params.push(userId);
    filters.push(`n.user_id = $${params.length}`);
  }

  if (unreadOnly) filters.push('n.read_at IS NULL');
  if (readOnly) filters.push('n.read_at IS NOT NULL');

  if (eventType && EVENT_TYPES.has(eventType)) {
    params.push(eventType);
    filters.push(`n.event_type = $${params.length}`);
  }
  if (actorId) {
    params.push(actorId);
    filters.push(`n.actor_id = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    filters.push(`n.created_at >= $${params.length}::timestamptz`);
  }
  if (dateTo) {
    params.push(dateTo);
    filters.push(`n.created_at <= $${params.length}::timestamptz`);
  }
  if (search) {
    params.push(`%${search}%`);
    filters.push(`(
      COALESCE(actor.full_name, '') ILIKE $${params.length}
      OR COALESCE(actor.username, '') ILIKE $${params.length}
      OR COALESCE(target.full_name, '') ILIKE $${params.length}
      OR COALESCE(target.username, '') ILIKE $${params.length}
      OR COALESCE(n.payload->>'termName', '') ILIKE $${params.length}
      OR COALESCE(n.payload->>'fullName', '') ILIKE $${params.length}
      OR COALESCE(n.payload->>'username', '') ILIKE $${params.length}
    )`);
  }

  return { whereSql: filters.length > 0 ? filters.join(' AND ') : '1=1', params };
}

export const listNotifications = async (req: AuthedRequest, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  const isAdmin = userRole === 'admin';
  const scopeAll = isAdmin && req.query.scope === 'all';

  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);
  const unreadOnly = req.query.read_status === 'unread' || req.query.unread_only === 'true';
  const readOnly = req.query.read_status === 'read';
  const eventType = normalizeText(req.query.event_type);
  const actorId = normalizeText(req.query.actor_id);
  const targetUserId = normalizeText(req.query.user_id);
  const dateFrom = normalizeText(req.query.date_from);
  const dateTo = normalizeText(req.query.date_to);
  const search = normalizeText(req.query.q);

  try {
    const { whereSql, params } = buildListNotificationsFilters({
      scopeAll, userId, targetUserId, unreadOnly, readOnly, eventType, actorId, dateFrom, dateTo, search,
    });
    const paramsWithPagination = [...params, limit, offset];

    const queryItems = `
      SELECT
        n.id,
        n.user_id,
        target.full_name AS target_user_name,
        target.username AS target_username,
        n.actor_id,
        n.event_type,
        n.entity_type,
        n.entity_id,
        n.term_id,
        n.payload,
        n.read_at,
        n.created_at,
        actor.full_name AS actor_name,
        actor.username AS actor_username
      FROM public.user_notifications n
      LEFT JOIN public.users actor ON actor.id = n.actor_id
      LEFT JOIN public.users target ON target.id = n.user_id
      WHERE ${whereSql}
      ORDER BY n.created_at DESC
      LIMIT $${paramsWithPagination.length - 1}
      OFFSET $${paramsWithPagination.length}
    `;

    const queryTotal = `
      SELECT COUNT(*)::int AS total_count
      FROM public.user_notifications n
      LEFT JOIN public.users actor ON actor.id = n.actor_id
      LEFT JOIN public.users target ON target.id = n.user_id
      WHERE ${whereSql}
    `;

    const [itemsResult, totalResult, unreadCountResult] = await Promise.all([
      db.query(queryItems, paramsWithPagination),
      db.query(queryTotal, params),
      db.query(
        `SELECT COUNT(*)::int AS unread_count
           FROM public.user_notifications
          WHERE user_id = $1
            AND read_at IS NULL`,
        [userId]
      ),
    ]);

    return res.status(200).json({
      unread_count: unreadCountResult.rows[0]?.unread_count ?? 0,
      total_count: totalResult.rows[0]?.total_count ?? 0,
      items: itemsResult.rows,
    });
  } catch (err) {
    if (isMissingNotificationsTable(err)) {
      console.error('[notifications][degraded] Tabela user_notifications ausente. Retornando lista vazia para evitar indisponibilidade no frontend.');
      return res.status(200).json({
        unread_count: 0,
        total_count: 0,
        items: [],
      });
    }
    console.error('[notifications] Erro ao listar notificações:', err);
    return res.status(500).json({ message: 'Erro ao carregar notificações.' });
  }
};

export const markNotificationRead = async (req: AuthedRequest, res: Response) => {
  const userId = req.user?.id;
  const notificationId = req.params.id;

  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const result = await db.query(
      `UPDATE public.user_notifications
          SET read_at = now()
        WHERE id = $1
          AND user_id = $2
          AND read_at IS NULL
      RETURNING id, read_at`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notificação não encontrada.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    if (isMissingNotificationsTable(err)) {
      console.error('[notifications][degraded] Tabela user_notifications ausente em markNotificationRead. Retornando noop.');
      return res.status(200).json({
        id: notificationId,
        read_at: null,
        degraded: true,
      });
    }
    console.error('[notifications] Erro ao marcar notificação como lida:', err);
    return res.status(500).json({ message: 'Erro ao atualizar notificação.' });
  }
};

export const markAllNotificationsRead = async (req: AuthedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const result = await db.query(
      `UPDATE public.user_notifications
          SET read_at = now()
        WHERE user_id = $1
          AND read_at IS NULL`,
      [userId]
    );

    return res.status(200).json({ updated: result.rowCount ?? 0 });
  } catch (err) {
    if (isMissingNotificationsTable(err)) {
      console.error('[notifications][degraded] Tabela user_notifications ausente em markAllNotificationsRead. Retornando noop.');
      return res.status(200).json({ updated: 0, degraded: true });
    }
    console.error('[notifications] Erro ao marcar todas como lidas:', err);
    return res.status(500).json({ message: 'Erro ao atualizar notificações.' });
  }
};
