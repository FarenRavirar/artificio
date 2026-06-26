import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { correctionSchema } from './utils';
import { registerDraftCorrection } from '../discord/utils';

const router = Router();

// ─── POST /drafts/:id/correction ───────────────────────────────────────────────

router.post('/:id/correction', requireAdmin, async (req: Request, res: Response) => {
  try {
    const draftId = req.params.id;
    if (!draftId || typeof draftId !== 'string') {
      return res.status(400).json({ error: 'ID do draft obrigatório.' });
    }

    const parsed = correctionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Payload inválido.' });
    }

    const result = await registerDraftCorrection({
      draftId,
      corrections: parsed.data.corrections,
      reason: parsed.data.reason,
      before: parsed.data.before,
      userId: req.user?.userId ?? undefined,
    });

    return res.json({ data: result });
  } catch (error: unknown) {
    const statusCode = (error as Record<string, unknown>)?.statusCode;
    if (typeof statusCode === 'number') {
      return res.status(statusCode).json({ error: (error as Error).message });
    }
    console.error('[POST /api/v1/admin/inbox/drafts/:id/correction]', error);
    return res.status(500).json({ error: 'Erro ao registrar correção.' });
  }
});

export default router;
