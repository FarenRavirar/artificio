import { Router } from 'express';
import { listAdminActivity } from '../controllers/adminActivityController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

router.get('/', authMiddleware, refreshUserRole, adminMiddleware, listAdminActivity);

export default router;
