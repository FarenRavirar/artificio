import { Router } from 'express';
import { catalogHealth, listSystems, createSystem, updateSystem, deleteSystem, listEditions, createEdition, updateEdition, deleteEdition } from '../controllers/systemController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

router.get('/health', catalogHealth);
router.get('/', listSystems);
router.post('/', authMiddleware, refreshUserRole, betaWriteGuard, createSystem); // Membros sugerem (pendente)
router.put('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, updateSystem);
router.delete('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, deleteSystem);

// Editions nested under system
router.get('/:systemId/editions', listEditions);
router.post('/:systemId/editions', authMiddleware, refreshUserRole, betaWriteGuard, createEdition); // Membros sugerem (pendente)
router.put('/editions/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, updateEdition);
router.delete('/editions/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, deleteEdition);

export default router;
