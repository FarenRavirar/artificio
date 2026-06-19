import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verifyMigrationHandler, claimMigrationHandler } from '../controllers/migrationController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Anti credential-stuffing: limita /verify por IP+email. Resposta uniforme.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${req.ip ?? 'unknown'}:${email}`;
  },
  message: { message: 'Muitas tentativas. Tente novamente mais tarde.' },
});

// Valida identidade legada (senha antiga). NÃO cria sessão.
router.post('/verify', verifyLimiter, verifyMigrationHandler);

// Conclui o vínculo: exige sessão SSO (Google) + migration_token.
router.post('/claim', authMiddleware, claimMigrationHandler);

export default router;
