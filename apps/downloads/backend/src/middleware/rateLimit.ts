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

// ============================================================================
// Buckets da fachada comunitária (achado de review, PR #268)
//
// `contrato-http-v1.md` §14 exige buckets independentes por ação, e
// `COMMENT_RATE_BUCKETS` fixa o vocabulário: `read`, `write`, `edit`, `vote`,
// `report`, `appeal`. Denunciar, retirar denúncia e recorrer usavam o
// `writeRateLimiter` — que é o bucket de **criar e editar material**, outro
// domínio inteiro. Publicar 60 materiais deixava o usuário sem cota para
// denunciar abuso, e vice-versa.
//
// Cada `rateLimit()` mantém seu próprio store, então instâncias separadas são o
// que torna os buckets independentes de fato.
// ============================================================================

/**
 * Denúncia e retirada de denúncia. Teto baixo de propósito — denúncia em massa
 * é o vetor de abuso da própria moderação —, mas separado da escrita: quem
 * denuncia demais não perde o direito de publicar material.
 */
export const commentReportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Recurso contra decisão de moderação. Bucket próprio, e não o de denúncia:
 * quem foi moderado tende a denunciar de volta, então o bucket comum tiraria
 * dele justamente a via de defesa que o contrato lhe garante.
 *
 * Teto baixo porque o domínio já limita: o recurso é um por decisão (segundo
 * recurso → `409`/`appeal_already_filed`, §12), e só o autor recorre. O que
 * este bucket barra é varredura de IDs de decisão alheia, não uso legítimo.
 */
export const commentAppealRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});
