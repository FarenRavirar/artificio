import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';
import { exportToMateCat } from '../controllers/exportController';
import { refreshUserRole } from '../middlewares/refreshUserRole';

const router = Router();

// Exportação (exige admin)
router.get('/matecat', authMiddleware, refreshUserRole, adminMiddleware, exportToMateCat);

export default router;
