import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

const createOrganizationSchema = z.object({
  slug: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(160),
});

// T1.6 (spec 074) — escopo minimo funcional (autorizado nominalmente
// 2026-07-12): organizacao = grupo de creators, dono vira admin automatico.
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const organizations = await db
    .selectFrom('download_organization_member')
    .innerJoin('download_organization', 'download_organization.id', 'download_organization_member.organization_id')
    .select(['download_organization.id', 'download_organization.slug', 'download_organization.name', 'download_organization_member.role'])
    .where('download_organization_member.user_id', '=', req.user!.userId)
    .execute();

  return res.json(organizations);
});

router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = createOrganizationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const organization = await db.transaction().execute(async (trx) => {
    const created = await trx
      .insertInto('download_organization')
      .values({ slug: parsed.data.slug, name: parsed.data.name, owner_user_id: req.user!.userId })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('download_organization_member')
      .values({ organization_id: created.id, user_id: req.user!.userId, role: 'admin' })
      .execute();

    return created;
  });

  return res.status(201).json(organization);
});

router.get('/:id/members', authMiddleware, async (req: Request, res: Response) => {
  const membership = await db
    .selectFrom('download_organization_member')
    .select('user_id')
    .where('organization_id', '=', req.params.id)
    .where('user_id', '=', req.user!.userId)
    .executeTakeFirst();

  if (!membership) {
    return res.status(403).json({ error: 'Você não participa desta organização.' });
  }

  const members = await db
    .selectFrom('download_organization_member')
    .select(['user_id', 'role', 'created_at'])
    .where('organization_id', '=', req.params.id)
    .execute();

  return res.json(members);
});

export default router;
