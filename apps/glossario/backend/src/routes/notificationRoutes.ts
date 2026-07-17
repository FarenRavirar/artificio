import { Router } from 'express';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

router.get('/', authMiddleware, refreshUserRole, listNotifications);
router.patch('/read-all', authMiddleware, refreshUserRole, markAllNotificationsRead);
router.patch('/:id/read', authMiddleware, refreshUserRole, markNotificationRead);

export default router;
