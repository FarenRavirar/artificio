import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

const asExpress4Handler = (handler: ReturnType<typeof rateLimit>): RequestHandler => handler as unknown as RequestHandler;

/**
 * Rate limiter para rotas públicas
 * Limite: 100 requisições por 15 minutos por IP
 */
export const publicRateLimiter = asExpress4Handler(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por janela
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
}));

export const globalRateLimiter = asExpress4Handler(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
}));

/**
 * Rate limiter para rotas autenticadas
 * Limite: 50 requisições por 15 minutos por IP
 */
export const authRateLimiter = asExpress4Handler(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // 50 requisições por janela
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
}));

/**
 * Rate limiter estrito para operações sensíveis
 * Limite: 10 requisições por 15 minutos por IP
 */
export const strictRateLimiter = asExpress4Handler(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 requisições por janela
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
}));
