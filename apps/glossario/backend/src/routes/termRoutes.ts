import { Router } from 'express';
import { listTerms, createTerm, approveTerm, updateTerm, deleteTerm, getTermHistory } from '../controllers/termController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

// Públicas
router.get('/', listTerms);
router.get('/:id/history', getTermHistory);

// Autenticadas (Membro e Admin)
router.post('/', authMiddleware, refreshUserRole, betaWriteGuard, createTerm);

// Admin Only
router.patch('/:id/approve', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, approveTerm);
router.patch('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, updateTerm);
router.delete('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, deleteTerm);

export default router;
