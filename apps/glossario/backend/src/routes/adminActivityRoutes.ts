import { Router } from 'express';
import { listAdminActivity } from '../controllers/adminActivityController';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';
import { refreshUserRole } from '../middlewares/refreshUserRole';

const router = Router();

router.get('/', authMiddleware, refreshUserRole, adminMiddleware, listAdminActivity);

export default router;
