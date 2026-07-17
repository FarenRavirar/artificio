import { Router } from 'express';
import { listFeedback, updateFeedback, deleteFeedback } from '../controllers/feedbackController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

// Triagem (admin). Mesmo padrao de adminActivityRoutes: auth -> refresh role -> admin.
router.use(authMiddleware, refreshUserRole, adminMiddleware);

router.get('/', listFeedback);
router.patch('/:id', updateFeedback);
router.delete('/:id', deleteFeedback);

export default router;
