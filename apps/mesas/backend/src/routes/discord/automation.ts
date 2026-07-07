import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../../db';
import { getAiAutomationConfig, assertAutoApprovalAllowed, getAiAutomationRollbackPlan } from '../../discord/aiAutomationConfig';
import { evaluatePredictions } from '../../discord/aiEval';
import { evaluateParseLayers, loadParseEvalDataset } from '../../discord/parseEval';
import { requireAdmin } from '../../middleware/auth';

const router = Router();

router.get('/config', requireAdmin, (_req: Request, res: Response) => {
  const config = getAiAutomationConfig();
  return res.json({
    data: {
      ...config,
      autoApprovalEnabled: false,
      rollback: getAiAutomationRollbackPlan(),
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

function normalizeEvalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

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

    const examples = rows.flatMap((row) => {
      const parsedBefore = normalizeEvalRecord(row.parsed_before);
      const humanCorrected = normalizeEvalRecord(row.human_corrected);
      if (!parsedBefore || !humanCorrected) return [];
      return [{ id: row.id, parsed_before: parsedBefore, human_corrected: humanCorrected }];
    });

    const deterministicBaseline = examples.map((example) => ({
      id: example.id,
      predicted: example.parsed_before,
    }));

    return res.json({
      data: {
        examples: examples.length,
        baseline: evaluatePredictions(examples, deterministicBaseline),
        parse_learning: {
          examples: 0,
          layers: [],
        },
      },
    });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/automation/eval]', error);
    return res.status(500).json({ error: 'Erro ao executar eval offline.' });
  }
});

router.get('/parse-eval', requireAdmin, async (req: Request, res: Response) => {
  const parsed = evalQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    const examples = await loadParseEvalDataset(parsed.data.limit);
    return res.json({
      data: {
        examples: examples.length,
        layers: evaluateParseLayers(examples),
      },
    });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/automation/parse-eval]', error);
    return res.status(500).json({ error: 'Erro ao executar eval do parser learning.' });
  }
});

router.get('/llm-activity', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .selectFrom('discord_llm_decisions')
      .select([
        'prompt_version',
        'status',
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where(sql<boolean>`created_at >= NOW() - INTERVAL '24 hours'`)
      .groupBy(['prompt_version', 'status'])
      .execute();

    const totals = rows.reduce((acc, row) => {
      const count = Number(row.count ?? 0);
      acc.total += count;
      if (String(row.prompt_version).startsWith('completeness-audit')) acc.completeness_audit += count;
      else acc.extraction += count;
      acc.by_status[String(row.status)] = (acc.by_status[String(row.status)] ?? 0) + count;
      return acc;
    }, { total: 0, extraction: 0, completeness_audit: 0, by_status: {} as Record<string, number> });

    return res.json({ data: { window_hours: 24, ...totals, rows } });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/automation/llm-activity]', error);
    return res.status(500).json({ error: 'Erro ao consultar atividade IA.' });
  }
});

export default router;
