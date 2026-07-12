import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

const favoriteSchema = z.object({
  material_id: z.string().trim().min(1),
});

// T5.1 (spec 074) — CRUD minimo de favorito, sempre por sessao.
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const favorites = await db
    .selectFrom('download_favorite')
    .innerJoin('download_material', 'download_material.id', 'download_favorite.material_id')
    .select(['download_material.id', 'download_material.slug', 'download_material.title', 'download_material.material_type', 'download_favorite.created_at'])
    .where('download_favorite.user_id', '=', req.user!.userId)
    .orderBy('download_favorite.created_at', 'desc')
    .execute();

  return res.json(favorites);
});

router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = favoriteSchema.safeParse(req.body ?? {});
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

  await db
    .insertInto('download_favorite')
    .values({ user_id: req.user!.userId, material_id: material.id })
    .onConflict((oc) => oc.columns(['user_id', 'material_id']).doNothing())
    .execute();

  return res.status(201).json({ material_id: material.id });
});

router.delete('/:materialId', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  await db
    .deleteFrom('download_favorite')
    .where('user_id', '=', req.user!.userId)
    .where('material_id', '=', req.params.materialId)
    .execute();

  return res.status(204).send();
});

export default router;
