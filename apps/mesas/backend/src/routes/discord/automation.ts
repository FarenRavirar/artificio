import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { getAiAutomationConfig, assertAutoApprovalAllowed } from '../../discord/aiAutomationConfig';
import { evaluatePredictions } from '../../discord/aiEval';
import { requireAdmin } from '../../middleware/auth';

const router = Router();

router.get('/config', requireAdmin, (_req: Request, res: Response) => {
  const config = getAiAutomationConfig();
  return res.json({
    data: {
      ...config,
      autoApprovalEnabled: false,
    },
  });
});

router.post('/auto-approval/guard', requireAdmin, (_req: Request, res: Response) => {
  try {
    assertAutoApprovalAllowed();
  } catch (error: unknown) {
    return res.status(423).json({ error: error instanceof Error ? error.message : 'Auto-aprovação bloqueada.' });
  }
});

const evalQuerySchema = z.object({
  limit: z.string().optional().transform((value) => {
    const parsed = value ? Number.parseInt(value, 10) : 100;
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 1000 ? parsed : 100;
  }),
});

router.get('/eval', requireAdmin, async (req: Request, res: Response) => {
  const parsed = evalQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    const rows = await db
      .selectFrom('import_corrections')
      .select(['id', 'parsed_before', 'human_corrected'])
      .orderBy('created_at', 'desc')
      .limit(parsed.data.limit)
      .execute();

    const examples = rows.map((row) => ({
      id: row.id,
      parsed_before: row.parsed_before as Record<string, unknown>,
      human_corrected: row.human_corrected as Record<string, unknown>,
    }));

    const deterministicBaseline = examples.map((example) => ({
      id: example.id,
      predicted: example.parsed_before,
    }));

    return res.json({
      data: {
        examples: examples.length,
        baseline: evaluatePredictions(examples, deterministicBaseline),
      },
    });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/automation/eval]', error);
    return res.status(500).json({ error: 'Erro ao executar eval offline.' });
  }
});

export default router;
