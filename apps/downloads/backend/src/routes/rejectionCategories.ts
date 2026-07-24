import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

// T2.1 (spec 083) — categoria de reprovacao e enum configuravel via admin
// (tabela, nao enum de codigo), com enquadramento legal BR quando aplicavel.
router.get('/', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const activeOnly = req.query.active !== 'false';

  let query = db.selectFrom('download_rejection_category').selectAll().orderBy('label', 'asc');
  if (activeOnly) {
    query = query.where('active', '=', true);
  }

  const categories = await query.execute();
  return res.json({ items: categories });
});

const createSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/, 'slug deve usar apenas letras minúsculas, números e underscore.'),
  label: z.string().trim().min(1).max(120),
  legal_basis: z.string().trim().max(300).nullable().optional(),
});

router.post('/', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const existing = await db
    .selectFrom('download_rejection_category')
    .select('id')
    .where('slug', '=', parsed.data.slug)
    .executeTakeFirst();
  if (existing) {
    return res.status(409).json({ error: 'Já existe uma categoria com este slug.' });
  }

  const created = await db
    .insertInto('download_rejection_category')
    .values({
      slug: parsed.data.slug,
      label: parsed.data.label,
      legal_basis: parsed.data.legal_basis ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

// slug e imutavel apos criacao (T2.2) — auditoria/relatorios referenciam por
// slug, trocar quebraria rastreio historico sem aviso. Schema nao aceita o
// campo; presenca no body e rejeitada explicitamente antes do parse.
const patchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  legal_basis: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().optional(),
});

router.patch('/:id', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if ('slug' in body) {
    return res.status(400).json({ error: 'Campo "slug" é imutável após a criação.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const category = await db
    .selectFrom('download_rejection_category')
    .select('id')
    .where('id', '=', req.params.id)
    .executeTakeFirst();
  if (!category) {
    return res.status(404).json({ error: 'Categoria não encontrada.' });
  }

  const updated = await db
    .updateTable('download_rejection_category')
    .set({ ...parsed.data, updated_at: new Date() })
    .where('id', '=', req.params.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.json(updated);
});

export default router;
