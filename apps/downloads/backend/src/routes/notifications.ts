import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

// T1.7 (spec 074) — escopo minimo funcional (autorizado nominalmente
// 2026-07-12): feed interno so-leitura + marcar como lida. Emissao de
// notificacao fica a cargo de quem dispara o evento (moderation.ts/
// reports.ts), fora do escopo desta rota.
router.get('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const notifications = await db
    .selectFrom('download_notification')
    .selectAll()
    .where('user_id', '=', req.user!.userId)
    .orderBy('created_at', 'desc')
    .limit(50)
    .execute();

  return res.json(notifications);
});

router.patch('/:id/read', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const notification = await db
    .selectFrom('download_notification')
    .select('id')
    .where('id', '=', req.params.id)
    .where('user_id', '=', req.user!.userId)
    .executeTakeFirst();

  if (!notification) {
    return res.status(404).json({ error: 'Notificação não encontrada.' });
  }

  await db
    .updateTable('download_notification')
    .set({ read_at: new Date() })
    .where('id', '=', req.params.id)
    .where('user_id', '=', req.user!.userId)
    .execute();

  return res.status(204).send();
});

export default router;
