import { Router } from 'express';
import { importTerms } from '../controllers/importController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

/**
 * POST /api/terms/import
 * Importação em massa de termos. Requer autenticação JWT.
 * Body: { terms: ImportRow[] }
 * Response: { summary: { total, inserted, updated, overrides, duplicates }, results: ImportResult[] }
 */
router.post('/', authMiddleware, refreshUserRole, betaWriteGuard, importTerms);

export default router;
