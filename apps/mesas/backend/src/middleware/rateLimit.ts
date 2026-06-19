import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter para rotas públicas
 * Limite: 100 requisições por 15 minutos por IP
 */
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 100, // 100 requisições por janela
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para rotas autenticadas
 * Limite: 50 requisições por 15 minutos por IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 50, // 50 requisições por janela
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter estrito para operações sensíveis
 * Limite: 10 requisições por 15 minutos por IP
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10, // 10 requisições por janela
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});
