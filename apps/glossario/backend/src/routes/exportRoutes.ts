import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { exportToMateCat } from '../controllers/exportController.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

// Exportação (exige admin)
router.get('/matecat', authMiddleware, refreshUserRole, adminMiddleware, exportToMateCat);

export default router;
