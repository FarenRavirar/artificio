import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { assertCanRate, RatingNotAllowedError } from '../services/ratingGuard';

const router = Router();

const upsertRatingSchema = z.object({
  material_id: z.string().trim().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable().optional(),
});

// D111 item 5 (spec 074) — usa o checker real (download_user_material_download)
// que o guard (spec 072) previu como parametro injetavel.
const hasDownloaded = async (userId: string, materialId: string): Promise<boolean> => {
  const record = await db
    .selectFrom('download_user_material_download')
    .select('user_id')
    .where('user_id', '=', userId)
    .where('material_id', '=', materialId)
    .executeTakeFirst();
  return Boolean(record);
};

router.get('/:materialId', async (req: Request, res: Response) => {
  const ratings = await db
    .selectFrom('download_rating')
    .select(['id', 'material_id', 'user_id', 'score', 'comment', 'created_at'])
    .where('material_id', '=', req.params.materialId)
    .orderBy('created_at', 'desc')
    .execute();

  return res.json(ratings);
});

router.put('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = upsertRatingSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  try {
    await assertCanRate(req.user!.userId, parsed.data.material_id, hasDownloaded);
  } catch (error) {
    if (error instanceof RatingNotAllowedError) {
      return res.status(403).json({ error: error.message });
    }
    throw error;
  }

  const rating = await db
    .insertInto('download_rating')
    .values({
      material_id: parsed.data.material_id,
      user_id: req.user!.userId,
      score: parsed.data.score,
      comment: parsed.data.comment ?? null,
    })
    .onConflict((oc) => oc.columns(['user_id', 'material_id']).doUpdateSet({
      score: parsed.data.score,
      comment: parsed.data.comment ?? null,
    }))
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(200).json(rating);
});

export default router;
