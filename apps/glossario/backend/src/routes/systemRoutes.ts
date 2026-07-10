import { Router } from 'express';
import { catalogHealth, listSystems, createSystem, updateSystem, deleteSystem, listEditions, createEdition, updateEdition, deleteEdition } from '../controllers/systemController';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';
import { betaWriteGuard } from '../middlewares/betaWriteGuard';
import { refreshUserRole } from '../middlewares/refreshUserRole';

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
