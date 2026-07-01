import { Router, Request, Response } from 'express';
import { sql } from 'kysely';
import { authMiddleware, requireRole } from '../middleware/auth';
import { db } from '../db';
import * as profileService from '../services/profileService';
import type { UserRole } from '../db/types';

const router = Router();

/**
 * Rotas administrativas de perfil
 * Requerem role 'admin'
 */

// =============================================================================
// PATCH /api/v1/admin/users/:id/covil — Toggle selo "Mestre do Covil"
// =============================================================================

router.patch(
  '/users/:id/covil',
  authMiddleware,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const adminId = req.user?.userId;
    const { id: userId } = req.params;
    const { verified } = req.body;

    if (!adminId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Campo "verified" deve ser boolean' });
    }

    try {
      await profileService.toggleCovilVerified(userId, verified, adminId);
      return res.json({
        data: {
          user_id: userId,
          covil_verified: verified,
          verified_by: adminId,
          verified_at: verified ? new Date() : null,
        },
      });
    } catch (error: any) {
      console.error('[PATCH /admin/users/:id/covil]', error);
      return res.status(500).json({ error: 'Erro ao atualizar selo Covil' });
    }
  }
);

// =============================================================================
// GET /api/v1/admin/users — Listar usuários (para gestão)
// =============================================================================

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

router.get('/users', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { search, role, covil_verified } = req.query;
  const page = clampInt(req.query.page, 1, 1, 100_000);
  const perPage = clampInt(req.query.per_page, 50, 1, 200);
  const offset = (page - 1) * perPage;

  try {
    // Filtros idênticos aplicados à query de dados e à de contagem (paginação real).
    const withFilters = <Q extends { where: (...args: any[]) => Q }>(query: Q): Q => {
      let q = query;
      if (typeof role === 'string' && ['visitor', 'player', 'gm', 'admin'].includes(role)) {
        q = q.where('u.role', '=', role as UserRole);
      }
      if (covil_verified === 'true') {
        q = q.where('gm.covil_verified', '=', true);
      } else if (covil_verified === 'false') {
        q = q.where((eb: any) => eb.or([
          eb('gm.covil_verified', '=', false),
          eb('gm.covil_verified', 'is', null),
        ]));
      }
      if (typeof search === 'string' && search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.where((eb: any) => eb.or([
          eb('u.email', 'ilike', s),
          eb('u.username', 'ilike', s),
          eb('p.display_name', 'ilike', s),
          eb('gm.nickname', 'ilike', s),
        ]));
      }
      return q;
    };

    const baseFrom = () => db
      .selectFrom('users as u')
      .leftJoin('profiles as p', 'p.user_id', 'u.id')
      .leftJoin('gm_profiles as gm', 'gm.user_id', 'u.id');

    const users = await withFilters(
      baseFrom()
        .select([
          'u.id',
          'u.email',
          'u.username',
          'u.role',
          'u.location',
          'u.created_at',
          'u.updated_at',
          'p.display_name',
          'p.avatar_url',
          'gm.slug as gm_slug',
          'gm.nickname as gm_nickname',
          sql<boolean>`COALESCE(gm.covil_verified, false)`.as('covil_verified'),
          'gm.covil_verified_at',
        ]) as any,
    )
      .orderBy('u.created_at', 'desc')
      .limit(perPage)
      .offset(offset)
      .execute();

    const totalRow = await withFilters(
      baseFrom().select(sql<number>`COUNT(DISTINCT u.id)::int`.as('count')) as any,
    ).executeTakeFirst();

    return res.json({
      data: users,
      meta: {
        total: Number(totalRow?.count ?? users.length),
        page,
        per_page: perPage,
      },
    });
  } catch (error: any) {
    console.error('[GET /admin/users]', error);
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// =============================================================================
// GET /api/v1/admin/users/:id — Detalhes de usuário (para gestão)
// =============================================================================

router.get(
  '/users/:id',
  authMiddleware,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const profile = await profileService.getFullProfile(id);
      return res.json({ data: profile });
    } catch (error: any) {
      console.error('[GET /admin/users/:id]', error);
      return res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
  }
);

export default router;
