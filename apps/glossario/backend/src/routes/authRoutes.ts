import { Router } from 'express';
import { login, register, getMe } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { betaPublicWriteGuard } from '../middlewares/betaWriteGuard';

const router = Router();

// Públicas
router.post('/register', betaPublicWriteGuard, register);
router.post('/login', login);

// Privadas (exigem JWT)
router.get('/me', authMiddleware, getMe);

export default router;
