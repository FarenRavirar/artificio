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

// ============================================================================
// Buckets da conversa comunitária (spec 090 T7; achado de review, PR #268)
//
// `contrato-http-v1.md` §Antiabuso exige buckets **independentes por ação**:
// "Nenhum consome a cota de `login`", e o mesmo vale entre as ações da
// conversa. `@artificio/comments` já fixa o vocabulário em
// `COMMENT_RATE_BUCKETS` — `read`, `write`, `edit`, `vote`, `report`, `appeal`.
//
// A primeira versão destas rotas reusava `strictRateLimiter` (10 req/15 min)
// para criar, responder, editar, retirar e votar. Duas consequências, e a
// segunda é a grave:
//
// 1. Orçamento **compartilhado**: dez votos legítimos esgotavam a cota e o
//    usuário levava `429` ao tentar publicar — exatamente o acoplamento que o
//    contrato proíbe.
// 2. Limite **dez vezes menor que o do módulo equivalente**: o `downloads` usa
//    60/15 min para escrita de fala (`downloads/middleware/rateLimit.ts:7`).
//    `strictRateLimiter` existe para operação sensível de painel, não para
//    conversa; herdá-lo tornaria a superfície inutilizável antes de qualquer
//    abuso.
//
// Cada instância de `rateLimit()` mantém seu próprio store, então instâncias
// separadas são o que torna os buckets independentes de fato.
//
// Estes limites são o teto **da fachada**, por IP. O `accounts.` aplica os
// dele por identidade e credencial, e §Antiabuso é explícito: "todos os
// buckets aplicáveis precisam liberar".
// ============================================================================

/** Criar comentário e responder. Mesmo teto do `downloads` para a mesma ação. */
export const commentWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Editar e auto-retirar. Bucket próprio: corrigir a própria fala é ação de
 * reparo, e gastá-la contra a cota de publicar puniria justamente quem está
 * arrumando o que escreveu.
 */
export const commentEditRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Voto. Teto mais alto porque o custo por requisição é menor e a ação é
 * naturalmente repetida ao percorrer uma árvore — e, sobretudo, porque votar
 * muito não pode impedir de comentar.
 */
export const commentVoteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Denúncia. Teto baixo de propósito — é o vetor de abuso da própria moderação
 * (denúncia em massa para esconder conteúdo) —, mas **separado** da escrita:
 * quem denuncia demais não perde o direito de comentar.
 */
export const commentReportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Muitas requisições deste IP. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Recurso contra decisão de moderação. Bucket próprio, e não o de denúncia
 * (achado de review, PR #268): são o sexto e o quinto item da lista de
 * `COMMENT_RATE_BUCKETS`, e §14 do contrato os separa de propósito.
 *
 * A consequência de compartilhar é a pior possível para esta ação: quem foi
 * moderado costuma denunciar de volta, então o mesmo IP esgota a cota de
 * denúncia e perde o direito de **recorrer da própria punição** — a única via
 * de defesa que o contrato lhe dá.
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
