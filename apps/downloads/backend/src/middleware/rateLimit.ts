import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter para rotas autenticadas de escrita (criação/edição de material)
 * Limite: 60 requisições por 15 minutos por IP
 */
export const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 60,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});
