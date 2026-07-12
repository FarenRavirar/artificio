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

/**
 * Rate limiter para rotas de leitura (GET) — orçamento separado e mais
 * permissivo que o de escrita, já que listagem/consulta não tem o mesmo
 * custo/risco de abuso que criação/edição.
 * Limite: 300 requisições por 15 minutos por IP
 */
export const readRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para rotas públicas sem sessão (ex.: changelog) — limite
 * generoso porque o conteúdo costuma ter cache em memória absorvendo rajada.
 */
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});
