import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';

const router = Router();

router.use(authMiddleware);

// GET /api/v1/notifications - Listar notificações do usuário
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const notifications = await db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();

    return res.json({ data: notifications });
  } catch (error: unknown) {
    console.error('[GET /notifications]', error);
    return res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
});

// PATCH /api/v1/notifications/read-all - Marcar todas as notificações do usuário como lidas
router.patch('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    await db
      .updateTable('notifications')
      .set({ read: true })
      .where('user_id', '=', userId)
      .where('read', '=', false)
      .execute();

    return res.json({ success: true });
  } catch (error: unknown) {
    console.error('[PATCH /notifications/read-all]', error);
    return res.status(500).json({ error: 'Erro ao marcar notificações como lidas.' });
  }
});

// PATCH /api/v1/notifications/:id/read - Marcar notificação como lida
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const updated = await db
      .updateTable('notifications')
      .set({ read: true })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (updated.numUpdatedRows === 0n) {
      return res.status(404).json({ error: 'Notificação não encontrada.' });
    }

    return res.json({ success: true });
  } catch (error: unknown) {
    console.error('[PATCH /notifications/:id/read]', error);
    return res.status(500).json({ error: 'Erro ao marcar notificação como lida.' });
  }
});

export default router;
