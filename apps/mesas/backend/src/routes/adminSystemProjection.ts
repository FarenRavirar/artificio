import { Router, type Request, type Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { applySystemProjection, planSystemProjection } from '../services/systemProjectionHydrator.js';

const router = Router();

router.post('/systems/projection-sync', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  if (process.env.APP_ENV?.trim().toLowerCase() !== 'beta') {
    return res.status(403).json({ error: 'system_projection_beta_only' });
  }
  const apply = req.body?.apply === true;
  try {
    const plan = await planSystemProjection();
    if (apply) await applySystemProjection(plan);
    return res.json({
      data: {
        mode: apply ? 'apply' : 'dry-run',
        catalog_version: plan.catalog_version,
        checksum: plan.checksum,
        counts: {
          create: plan.create.length,
          update: plan.update.length,
          unchanged: plan.unchanged.length,
          lifecycle: plan.lifecycle.length,
          remap: plan.remap.length,
          beta_extra: plan.beta_extra.length,
          conflicts: plan.conflicts.length,
        },
        changes: {
          create: plan.create,
          update: plan.update,
          unchanged: plan.unchanged,
          lifecycle: plan.lifecycle,
          remap: plan.remap,
          beta_extra: plan.beta_extra,
        },
        conflicts: plan.conflicts,
      },
    });
  } catch (error) {
    console.error('[POST /admin/systems/projection-sync]', error);
    return res.status(503).json({ error: 'system_projection_failed' });
  }
});

export default router;
