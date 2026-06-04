import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import * as profileService from '../services/profileService';

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

router.get('/users', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { search, role, covil_verified } = req.query;

  try {
    // TODO: Implementar listagem com filtros
    // Por enquanto, retorna estrutura básica
    return res.json({
      data: [],
      meta: {
        total: 0,
        page: 1,
        per_page: 20,
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
