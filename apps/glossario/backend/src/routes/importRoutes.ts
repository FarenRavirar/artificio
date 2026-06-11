import { Router } from 'express';
import { importTerms } from '../controllers/importController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { betaWriteGuard } from '../middlewares/betaWriteGuard';
import { refreshUserRole } from '../middlewares/refreshUserRole';

const router = Router();

/**
 * POST /api/terms/import
 * Importação em massa de termos. Requer autenticação JWT.
 * Body: { terms: ImportRow[] }
 * Response: { summary: { total, inserted, updated, overrides, duplicates }, results: ImportResult[] }
 */
router.post('/', authMiddleware, refreshUserRole, betaWriteGuard, importTerms);

export default router;
