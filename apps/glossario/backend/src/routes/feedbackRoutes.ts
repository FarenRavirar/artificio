import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitFeedback } from '../controllers/feedbackController';
import { optionalAuthMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Anti-flood do endpoint publico: limita envios por IP.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitos envios. Tente novamente mais tarde.' },
});

// POST publico (anonimo permitido; sessao opcional enriquece o registro).
router.post('/', submitLimiter, optionalAuthMiddleware, submitFeedback);

export default router;
