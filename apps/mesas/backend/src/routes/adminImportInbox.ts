import { Router } from 'express';

import importRouter from './inbox/import';
import draftsRouter from './inbox/drafts';
import correctionsRouter from './inbox/corrections';

const router = Router();

// ─── Sub-rotas por domínio ─────────────────────────────────────────────────────
//      D10 — adminImportInbox.ts split por domínio: import/, drafts/, corrections/
//      (T8.1 spec 057: /metrics removido — redundante com GET /admin/discord/metrics, sem caller)

router.use('/import-text', importRouter);
router.use('/drafts', draftsRouter);
router.use('/drafts', correctionsRouter);

export default router;
