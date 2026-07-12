import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

const registerDownloadSchema = z.object({
  material_id: z.string().trim().min(1),
});

// T3.1/T3.2 (spec 074) — clique logado no CTA registra download. Dedup por
// (conta, material) via PK composta em download_user_material_download:
// so a PRIMEIRA insercao incrementa download_metric_daily (criterio de
// aceite 4); cliques seguintes da mesma conta retornam already=true sem
// incrementar de novo, mas o CTA continua redirecionando normalmente.
router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = registerDownloadSchema.safeParse(req.body ?? {});
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

  const inserted = await db
    .insertInto('download_user_material_download')
    .values({ user_id: req.user!.userId, material_id: material.id })
    .onConflict((oc) => oc.columns(['user_id', 'material_id']).doNothing())
    .returning('user_id')
    .executeTakeFirst();

  const isFirstDownload = Boolean(inserted);

  if (isFirstDownload) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await db
      .insertInto('download_metric_daily')
      .values({ material_id: material.id, metric_date: today, download_count: 1 })
      .onConflict((oc) => oc.columns(['material_id', 'metric_date']).doUpdateSet((eb) => ({
        download_count: eb('download_metric_daily.download_count', '+', 1),
      })))
      .execute();
  }

  return res.status(200).json({ already_counted: !isFirstDownload });
});

export default router;
