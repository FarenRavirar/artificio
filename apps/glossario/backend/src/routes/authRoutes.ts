import { Router } from 'express';
import { gone, getMe } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Login de sessão / cadastro legados desativados (spec 015) → 410 Gone.
// Único login = Google OAuth via accounts. (D018).
router.post('/register', gone);
router.post('/login', gone);

// Privada: sessão SSO (cookie artificio_session ou Bearer).
router.get('/me', authMiddleware, getMe);

export default router;
