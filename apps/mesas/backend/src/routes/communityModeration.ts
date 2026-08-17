import { Router, type Request, type Response, type NextFunction } from 'express';
import { moderationQueueSchema } from '@artificio/comments';
import { authMiddleware } from '../middleware/auth.js';
import {
  actingAccountsUserId,
  filteredQuery,
  proxyToAccounts,
  type UpstreamMode,
} from '../community/accountsProxy.js';
import {
  commentReportRateLimiter,
  publicRateLimiter,
  strictRateLimiter,
} from '../middleware/rateLimit.js';

/**
 * T7.7 (spec 090) — fachada de moderação de comentário do `mesas`.
 *
 * Comentário em mesa é conteúdo público, então a mesma moderação global que
 * cobre `downloads` e `site` precisa alcançá-lo. Molde de
 * `downloads/routes/communityModeration.ts`, com **uma diferença que não é
 * cosmética** — ver `requireCommentModerator` abaixo.
 */

const router = Router();
type UpstreamValidation = (body: unknown) => { ok: true; data: unknown } | { ok: false };

/**
 * ## Por que este guard existe, em vez de `requireRole(['moderator','admin'])`
 *
 * O `mesas` **rebaixa** o `moderator` central: `resolveEffectiveMesasRole`
 * (`middleware/auth.ts:41-47`) devolve `player` para ele, e o teste
 * `auth.roles.test.ts:9-12` fixa isso de propósito — moderador global não ganha
 * capacidade administrativa **de domínio** (gerir mesa, sistema, catálogo).
 * Essa decisão está certa e não muda aqui.
 *
 * Mas moderar **comentário** não é capacidade de domínio. A matriz de
 * capacidades da spec (`spec.md:346`) diz, para a coluna `mesas`, que "retirar
 * comentário público" é **herdada na adoção**, enquanto `:348` mantém que ele
 * "não herda administração de mesa". São linhas diferentes da mesma tabela.
 *
 * Por isso o guard lê `globalRole` — o papel que veio do `accounts.` — e não
 * `role`, que é o efetivo local já rebaixado. Usar `requireRole` aqui faria o
 * moderador global receber `403` em todo comentário de mesa, e o poder que a
 * spec concede não existiria na prática, sem erro em lugar nenhum.
 */
function requireCommentModerator(req: Request, res: Response, next: NextFunction): void {
  const globalRole = req.user?.globalRole;
  if (globalRole !== 'moderator' && globalRole !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

// Limiter na fachada, além do que o `accounts.` já aplica por usuário e
// credencial: a fachada é quem conhece o IP real do cliente (requisito 12b —
// "todos os buckets aplicáveis precisam liberar").
//
// Três buckets distintos nesta superfície (achado de review, PR #268 —
// `contrato-http-v1.md` §Antiabuso exige independência por ação):
// - leitura de moderador (`publicRateLimiter`, 100/15 min);
// - ação de moderador (`strictRateLimiter`, 10/15 min — teto baixo e proposital:
//   retirar e restaurar comentário são operações raras e de alto impacto);
// - denúncia e recurso do usuário comum (`commentReportRateLimiter`, 20/15 min).
//
// A denúncia **não** pode compartilhar bucket com a ação de moderador: são
// pessoas diferentes exercendo direitos diferentes, e um moderador ativo
// esgotaria a cota de quem só quer reportar abuso — ou o contrário.
const moderatorRead = [authMiddleware, requireCommentModerator, publicRateLimiter];
const moderatorWrite = [authMiddleware, requireCommentModerator, strictRateLimiter];

/**
 * Vocabulário de erro desta fachada. A mecânica de transporte (credencial,
 * headers validados, `Retry-After`, degradação) vive em
 * `community/accountsProxy.ts`, compartilhada com a fachada de conversa.
 */
const UNAVAILABLE_ERROR = 'community_moderation_unavailable';

function proxyAccounts(
  req: Request,
  res: Response,
  path: string,
  mode: UpstreamMode,
  validate?: UpstreamValidation,
): Promise<void> {
  return proxyToAccounts(req, res, path, {
    mode,
    unavailableError: UNAVAILABLE_ERROR,
    logPrefix: 'community-moderation',
    actingUserId: actingAccountsUserId(req),
    // Moderação é sempre ação de alguém identificado: sem ator resolvido, 401
    // explícito em vez de chamada anônima ao registro central.
    requireActingUser: true,
    validate,
  });
}

/** Valida a fila contra o schema compartilhado, só no caminho de sucesso. */
function proxyQueue(req: Request, res: Response, path: string): Promise<void> {
  return proxyAccounts(req, res, path, 'service', (body) => {
    const parsed = moderationQueueSchema.safeParse(body);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
  });
}

// --- Superfície do usuário comum: denunciar e recorrer -----------------------

router.get('/reports', authMiddleware, publicRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, '/api/v1/community/reports', 'session').catch(next);
});
router.get('/appeals/:id', authMiddleware, publicRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/api/v1/community/appeals/${encodeURIComponent(req.params.id)}`, 'session').catch(next);
});
router.get('/report-reasons', authMiddleware, publicRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, '/internal/v1/report-reasons', 'service').catch(next);
});
router.post('/comments/:id/reports', authMiddleware, commentReportRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/reports`, 'service').catch(next);
});
router.delete('/reports/:id', authMiddleware, commentReportRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/reports/${encodeURIComponent(req.params.id)}`, 'service').catch(next);
});
router.post('/decisions/:id/appeals', authMiddleware, commentReportRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/decisions/${encodeURIComponent(req.params.id)}/appeals`, 'service').catch(next);
});

// --- Superfície do moderador global -----------------------------------------

router.get('/moderation/queue', moderatorRead, (req: Request, res: Response, next: NextFunction) => {
  const query = filteredQuery(req, ['source_app', 'status', 'max_priority', 'limit', 'cursor_opened_at', 'cursor_id']);
  proxyQueue(req, res, `/internal/v1/comments/moderation-queue${query}`).catch(next);
});
router.get('/moderation/log', moderatorRead, (req: Request, res: Response, next: NextFunction) => {
  const query = filteredQuery(req, ['limit', 'cursor_occurred_at', 'cursor_id']);
  proxyAccounts(req, res, `/internal/v1/comments/moderation-log${query}`, 'service').catch(next);
});
router.get('/moderation/comments/:id/versions', moderatorRead, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/versions`, 'service').catch(next);
});
router.post('/moderation/comments/:id/removal', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/removal`, 'service').catch(next);
});
router.post('/moderation/comments/:id/restore', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/restore`, 'service').catch(next);
});
router.get('/moderation/cases/:id', moderatorRead, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}`, 'service').catch(next);
});
router.post('/moderation/cases/:id/resolution', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}/resolution`, 'service').catch(next);
});
router.post('/moderation/cases/:id/reopen', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}/reopen`, 'service').catch(next);
});
router.patch('/moderation/cases/:id/priority', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}/priority`, 'service').catch(next);
});
router.get('/moderation/appeals/:id', moderatorRead, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/appeals/${encodeURIComponent(req.params.id)}`, 'service').catch(next);
});
router.post('/moderation/appeals/:id/resolution', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/appeals/${encodeURIComponent(req.params.id)}/resolution`, 'service').catch(next);
});
router.get('/moderation/sanctions', moderatorRead, (req: Request, res: Response, next: NextFunction) => {
  const query = filteredQuery(req, ['actor_id']);
  proxyAccounts(req, res, `/internal/v1/moderation/sanctions${query}`, 'service').catch(next);
});
router.post('/moderation/sanctions', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, '/internal/v1/moderation/sanctions', 'service').catch(next);
});
router.delete('/moderation/sanctions/:id', moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/sanctions/${encodeURIComponent(req.params.id)}`, 'service').catch(next);
});

export default router;
