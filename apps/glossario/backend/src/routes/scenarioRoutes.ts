import { Router } from 'express';
import { listScenarios, createScenario, updateScenario, deleteScenario } from '../controllers/scenarioController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

router.get('/', listScenarios);
router.post('/', authMiddleware, refreshUserRole, betaWriteGuard, createScenario); // Membros sugerem (pendente)
router.put('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, updateScenario);
router.delete('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, deleteScenario);

export default router;
