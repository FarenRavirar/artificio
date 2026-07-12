import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

const createCollectionSchema = z.object({
  slug: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  is_public: z.boolean().optional(),
});

const addItemSchema = z.object({
  material_id: z.string().trim().min(1),
});

// T5.2 (spec 074) — CRUD minimo de colecao (sempre por sessao) + itens.
router.get('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const collections = await db
    .selectFrom('download_collection')
    .selectAll()
    .where('user_id', '=', req.user!.userId)
    .orderBy('created_at', 'desc')
    .execute();

  return res.json(collections);
});

router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = createCollectionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const created = await db
    .insertInto('download_collection')
    .values({
      user_id: req.user!.userId,
      slug: parsed.data.slug,
      title: parsed.data.title,
      is_public: parsed.data.is_public ?? false,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

async function assertOwnsCollection(collectionId: string, userId: string) {
  return db
    .selectFrom('download_collection')
    .select('id')
    .where('id', '=', collectionId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

router.get('/:id/items', writeRateLimiter, optionalAuth, async (req: Request, res: Response) => {
  const collection = await db
    .selectFrom('download_collection')
    .select(['id', 'user_id', 'is_public'])
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!collection) {
    return res.status(404).json({ error: 'Coleção não encontrada.' });
  }

  if (!collection.is_public && req.user?.userId !== collection.user_id) {
    return res.status(403).json({ error: 'Coleção privada.' });
  }

  const items = await db
    .selectFrom('download_collection_item')
    .innerJoin('download_material', 'download_material.id', 'download_collection_item.material_id')
    .select(['download_material.id', 'download_material.slug', 'download_material.title', 'download_material.material_type', 'download_collection_item.added_at'])
    .where('download_collection_item.collection_id', '=', req.params.id)
    .where('download_material.editorial_state', '=', 'published')
    .orderBy('download_collection_item.added_at', 'desc')
    .execute();

  return res.json(items);
});

router.post('/:id/items', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = addItemSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const owned = await assertOwnsCollection(req.params.id, req.user!.userId);
  if (!owned) {
    return res.status(404).json({ error: 'Coleção não encontrada.' });
  }

  await db
    .insertInto('download_collection_item')
    .values({ collection_id: req.params.id, material_id: parsed.data.material_id })
    .onConflict((oc) => oc.columns(['collection_id', 'material_id']).doNothing())
    .execute();

  return res.status(201).json({ material_id: parsed.data.material_id });
});

router.delete('/:id/items/:materialId', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const owned = await assertOwnsCollection(req.params.id, req.user!.userId);
  if (!owned) {
    return res.status(404).json({ error: 'Coleção não encontrada.' });
  }

  await db
    .deleteFrom('download_collection_item')
    .where('collection_id', '=', req.params.id)
    .where('material_id', '=', req.params.materialId)
    .execute();

  return res.status(204).send();
});

export default router;
