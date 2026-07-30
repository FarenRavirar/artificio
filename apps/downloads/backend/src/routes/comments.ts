import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { sanitizeUserMarkdown } from '@artificio/content-editor/sanitize';

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

  // O `min(1)` do Zod roda antes da sanitização: entrada só-markup
  // (`<script>alert(1)</script>`) passava na validação, saía vazia daqui e
  // criava comentário invisível com 201 (review PR #227).
  const safeBody = sanitizeUserMarkdown(parsed.data.body);
  if (!safeBody.trim()) {
    return res.status(400).json({ error: 'Comentário não pode ser vazio.' });
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
      body: safeBody,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

router.get('/:materialId', async (req: Request, res: Response) => {
  const comments = await db
    .selectFrom('download_comment')
    .select(['id', 'material_id', 'user_id', 'body', 'removed_at', 'created_at'])
    .where('material_id', '=', req.params.materialId)
    .orderBy('created_at', 'asc')
    .execute();

  return res.json(comments.map((comment) => ({
    ...comment,
    body: comment.removed_at ? null : sanitizeUserMarkdown(comment.body),
    removed_by_moderation: Boolean(comment.removed_at),
  })));
});

// D111 item 6 + decisão do mantenedor de 2026-07-29: comentário só é retirado
// quando uma denúncia é acatada em PATCH /reports/:id. Não existe exclusão
// livre pelo autor nem remoção direta de rotina pela moderação nesta rota.

export default router;
