import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import { createCorrectionHandler } from './utils';

// REV-016 onda 3: handler compartilhado com inbox/corrections.ts
const router = createCorrectionHandler('/admin/discord-sync/drafts/:id/correction');

// ─── T-G5 — Export de exemplos few-shot (correções → prompt/response) ────────

const exportQuerySchema = z.object({
  limit: z.string().optional().transform((s) => {
    const n = s ? Number.parseInt(s, 10) : 50;
    return Number.isFinite(n) && n > 0 && n <= 500 ? n : 50;
  }),
  offset: z.string().optional().transform((s) => {
    const n = s ? Number.parseInt(s, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }),
  reason: z.string().optional(),
  corrected_by: z.string().optional(),
});

interface FewShotExample {
  instruction: string;
  input: {
    raw_text: string;
    parsed_before: Record<string, unknown>;
  };
  output: {
    corrections: Record<string, { before: unknown; after: unknown }>;
    reason: string | null;
  };
}

router.get('/export/few-shot', authRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const qs = exportQuerySchema.safeParse(req.query);
    if (!qs.success) return res.status(400).json({ error: 'Parâmetros inválidos.' });

    let query = db
      .selectFrom('import_corrections')
      .select(['raw_text', 'parsed_before', 'diff', 'reason'])
      .where('raw_text', 'is not', null)
      .orderBy('created_at', 'desc')
      .limit(qs.data.limit)
      .offset(qs.data.offset);

    if (qs.data.reason) query = query.where('reason', '=', qs.data.reason);
    if (qs.data.corrected_by) query = query.where('corrected_by', '=', qs.data.corrected_by);

    const rows = await query.execute();

    const examples: FewShotExample[] = rows.map((row) => ({
      instruction: 'Corrija os campos extraídos de um anúncio de mesa de RPG. Preencha campos faltantes, corrija erros de sistema/dia/horário/vagas, e normalize o contato.',
      input: {
        raw_text: row.raw_text ?? '',
        parsed_before: (row.parsed_before as Record<string, unknown>) ?? {},
      },
      output: {
        corrections: (row.diff as Record<string, { before: unknown; after: unknown }>) ?? {},
        reason: row.reason,
      },
    }));

    return res.json({ data: { examples, count: examples.length, offset: qs.data.offset } });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/drafts/export/few-shot]', error);
    return res.status(500).json({ error: 'Erro ao exportar exemplos few-shot.' });
  }
});

// ─── T-G5 — Export de conjunto de avaliação (dados rotulados) ─────────────────

interface EvalExample {
  id: string;
  raw_text: string;
  parsed_before: Record<string, unknown>;
  human_corrected: Record<string, unknown>;
  diff: Record<string, { before: unknown; after: unknown }>;
  reason: string | null;
  corrected_at: Date | null;
}

router.get('/export/eval', authRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const qs = exportQuerySchema.safeParse(req.query);
    if (!qs.success) return res.status(400).json({ error: 'Parâmetros inválidos.' });

    let query = db
      .selectFrom('import_corrections')
      .select(['id', 'raw_text', 'parsed_before', 'human_corrected', 'diff', 'reason', 'created_at'])
      .orderBy('created_at', 'desc')
      .limit(qs.data.limit)
      .offset(qs.data.offset);

    if (qs.data.reason) query = query.where('reason', '=', qs.data.reason);
    if (qs.data.corrected_by) query = query.where('corrected_by', '=', qs.data.corrected_by);

    const rows = await query.execute();

    const examples: EvalExample[] = rows.map((row) => ({
      id: row.id,
      raw_text: row.raw_text ?? '',
      parsed_before: (row.parsed_before as Record<string, unknown>) ?? {},
      human_corrected: (row.human_corrected as Record<string, unknown>) ?? {},
      diff: (row.diff as Record<string, { before: unknown; after: unknown }>) ?? {},
      reason: row.reason,
      corrected_at: row.created_at,
    }));

    return res.json({ data: { examples, count: examples.length, offset: qs.data.offset } });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/drafts/export/eval]', error);
    return res.status(500).json({ error: 'Erro ao exportar conjunto de avaliação.' });
  }
});

export default router;
