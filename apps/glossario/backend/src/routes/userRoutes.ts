import { Router } from 'express';
import { updateProfile, listUsers, toggleBan } from '../controllers/userController';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';
import { betaWriteGuard } from '../middlewares/betaWriteGuard';
import { refreshUserRole } from '../middlewares/refreshUserRole';

const router = Router();

// Autenticadas (ME)
router.patch('/profile', authMiddleware, refreshUserRole, betaWriteGuard, updateProfile);

// Admin Only
router.get('/admin', authMiddleware, refreshUserRole, adminMiddleware, listUsers);
router.post('/admin/:id/ban', authMiddleware, refreshUserRole, adminMiddleware, toggleBan);

export default router;
