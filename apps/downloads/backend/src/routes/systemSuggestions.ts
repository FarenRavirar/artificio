import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

// T4.7 (spec 086, Fase 4) — usuário comum sugere sistema pra um material que
// não tem (ou tem hint não casado). Espelha POST /api/v1/system-suggestions
// do mesas: mesmo contrato, fila e tabela próprias do Downloads
// (download_system_suggestion, nunca a system_suggestions do mesas).
const createSuggestionSchema = z.object({
  material_id: z.string().trim().min(1),
  raw_value: z.string().trim().min(1).max(200),
});

router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = createSuggestionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const material = await db
    .selectFrom('download_material')
    .select(['id', 'system_id'])
    .where('id', '=', parsed.data.material_id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  if (material.system_id) {
    return res.status(409).json({ error: 'Este material já tem um sistema associado.' });
  }

  const created = await db
    .insertInto('download_system_suggestion')
    .values({
      material_id: parsed.data.material_id,
      raw_value: parsed.data.raw_value,
      source: 'user',
      suggested_by_user_id: req.user!.userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

// "Minhas sugestões" — mesmo padrão de GET /reports/mine.
router.get('/mine', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const suggestions = await db
    .selectFrom('download_system_suggestion')
    .selectAll()
    .where('suggested_by_user_id', '=', req.user!.userId)
    .orderBy('created_at', 'desc')
    .execute();

  return res.json(suggestions);
});

export default router;
