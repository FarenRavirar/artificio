import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';

const router = Router();

// ─── GET /metrics ─────────────────────────────────────────────────────────────

router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const totalDrafts = await db
      .selectFrom('import_corrections')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    const fieldsByCount = await db
      .selectFrom('import_corrections')
      .select('diff')
      .execute();

    const fieldCounts: Record<string, number> = {};
    for (const row of fieldsByCount) {
      const diff = row.diff as Record<string, unknown>;
      if (diff && typeof diff === 'object') {
        for (const key of Object.keys(diff)) {
          fieldCounts[key] = (fieldCounts[key] ?? 0) + 1;
        }
      }
    }

    return res.json({
      data: {
        total_corrections: totalDrafts?.count ?? 0,
        most_corrected_fields: Object.entries(fieldCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([field, count]) => ({ field, count })),
      },
    });
  } catch (error: unknown) {
    console.error('[GET /api/v1/admin/inbox/metrics]', error);
    return res.status(500).json({ error: 'Erro ao carregar métricas.' });
  }
});

export default router;
