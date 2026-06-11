import { Router } from 'express';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { refreshUserRole } from '../middlewares/refreshUserRole';

const router = Router();

router.get('/', authMiddleware, refreshUserRole, listNotifications);
router.patch('/read-all', authMiddleware, refreshUserRole, markAllNotificationsRead);
router.patch('/:id/read', authMiddleware, refreshUserRole, markNotificationRead);

export default router;
