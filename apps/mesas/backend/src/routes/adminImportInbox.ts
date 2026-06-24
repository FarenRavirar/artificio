import { Router } from 'express';

import importRouter from './inbox/import';
import draftsRouter from './inbox/drafts';
import correctionsRouter from './inbox/corrections';
import metricsRouter from './inbox/metrics';

const router = Router();

// ─── Sub-rotas por domínio ─────────────────────────────────────────────────────
//      D10 — adminImportInbox.ts split por domínio: import/, drafts/, corrections/, metrics/

router.use('/import-text', importRouter);
router.use('/drafts', draftsRouter);
router.use('/drafts', correctionsRouter);
router.use('/metrics', metricsRouter);

export default router;
