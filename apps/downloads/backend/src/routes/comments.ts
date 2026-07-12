import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

const createCommentSchema = z.object({
  material_id: z.string().trim().min(1),
  body: z.string().trim().min(1).max(2000),
});

// T6.1 — comentario exige conta accounts. (authMiddleware), sem fluxo
// anonimo (critério de aceite 6).
router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = createCommentSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const material = await db
    .selectFrom('download_material')
    .select('id')
    .where('id', '=', parsed.data.material_id)
    .where('editorial_state', '=', 'published')
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const created = await db
    .insertInto('download_comment')
    .values({
      material_id: parsed.data.material_id,
      user_id: req.user!.userId,
      body: parsed.data.body,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

router.get('/:materialId', async (req: Request, res: Response) => {
  const comments = await db
    .selectFrom('download_comment')
    .select(['id', 'material_id', 'user_id', 'body', 'created_at'])
    .where('material_id', '=', req.params.materialId)
    .where('removed_at', 'is', null)
    .orderBy('created_at', 'asc')
    .execute();

  return res.json(comments);
});

// T6.1 — retirada so por denuncia/moderacao, nunca autoexclusao livre nem
// edicao pelo autor (D111 item 6: sem moderação prévia de rotina, mas
// retirada pontual por denúncia continua exigindo role).
router.delete('/:id', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const comment = await db
    .selectFrom('download_comment')
    .select('id')
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!comment) {
    return res.status(404).json({ error: 'Comentário não encontrado.' });
  }

  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'Removido por denúncia/moderação.';

  await db
    .updateTable('download_comment')
    .set({ removed_at: new Date(), removed_reason: reason })
    .where('id', '=', req.params.id)
    .execute();

  return res.status(204).send();
});

export default router;
