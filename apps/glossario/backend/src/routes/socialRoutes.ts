import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';
import { upsertVote } from '../controllers/voteController.js';
import { getCommentsByTerm, createComment, deleteComment } from '../controllers/commentController.js';

const router = Router();

// Votos (exige login)
router.post('/:id/vote', authMiddleware, refreshUserRole, betaWriteGuard, upsertVote);

// Comentários
router.get('/:id/comments', getCommentsByTerm); // Público
router.post('/:id/comments', authMiddleware, refreshUserRole, betaWriteGuard, createComment); // Logado
router.delete('/comments/:id', authMiddleware, refreshUserRole, betaWriteGuard, deleteComment); // Logado (dono ou admin)

export default router;
