import { Router, type Request, type Response, type NextFunction } from 'express';
import { moderationQueueSchema } from '@artificio/comments';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  commentAppealRateLimiter,
  commentReportRateLimiter,
  readRateLimiter,
  writeRateLimiter,
} from '../middleware/rateLimit';
import {
  filteredQuery,
  proxyToAccounts,
  type UpstreamMode,
  type UpstreamValidation,
} from '../community/accountsProxy';

const router = Router();

// Limiter na fachada, além do que o `accounts.` já aplica por usuário e
// credencial: a fachada é quem conhece o IP real do cliente (requisito 12b —
// "todos os buckets aplicáveis precisam liberar"), e sem ele um IP autenticado
// converte uma requisição barata daqui em carga no `accounts.`, que é o app
// sagrado do SSO. Achado do CodeQL na PR #262 (`js/missing-rate-limiting`, 20
// rotas): handler que decide autorização sem limite é alvo de força bruta de
// papel/ID. Leitura e escrita usam buckets separados — o orçamento de listar
// fila não pode ser consumido por quem só remove comentário, e vice-versa.
//
// **O limiter vem ANTES de `authMiddleware`, e a ordem não é estética** (CodeQL
// reincidiu na PR #268): com a autenticação primeiro, toda requisição paga a
// validação de JWT antes de qualquer freio, e a rota vira amplificador — o
// atacante gasta um header inválido, o servidor gasta verificação de
// assinatura. Com o limiter na frente, a rajada morre em `429` sem tocar em
// cripto. Seguro porque nenhum destes buckets usa `keyGenerator`, `skip` ou lê
// `req.user`: todos chaveiam por IP, que existe antes de autenticar. É também a
// ordem que a fachada de conversa deste app já usava (`communityComments.ts`);
// a moderação é que era a exceção.
const moderatorRead = [readRateLimiter, authMiddleware, requireRole(['moderator', 'admin'])];
const moderatorWrite = [writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin'])];
/**
 * Vocabulário de erro desta fachada. A mecânica de transporte (credencial,
 * headers validados, `Retry-After`, degradação) vive em
 * `community/accountsProxy.ts`, compartilhada com a fachada de conversa.
 *
 * A unificação corrigiu duas lacunas que a cópia daqui tinha e a da conversa
 * não (achado de review, PR #268): `Retry-After` não atravessava — pior
 * justamente aqui, onde o operador insiste ao ver `429` — e o corpo de erro
 * não trazia `correlation_id`, que `contrato-http-v1.md` §1.1 exige em toda
 * resposta de erro.
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
    actingUserId: req.user?.userId,
    // Moderação é sempre ação de alguém identificado: sem ator resolvido, 401
    // explícito em vez de chamada anônima ao registro central.
    requireActingUser: true,
    validate,
  });
}

/**
 * Valida a fila contra o schema compartilhado. Era um monkey patch em
 * `res.json` (achado de review, PR #262): além de reentrante e difícil de
 * seguir, ele reescrevia um método do Express para toda a vida da resposta,
 * então qualquer `res.json` posterior — inclusive o de um error handler —
 * passaria pela validação da fila. Agora é um parâmetro explícito de
 * `proxyAccounts`, aplicado só no caminho de sucesso.
 */
function proxyQueue(req: Request, res: Response, path: string): Promise<void> {
  return proxyAccounts(req, res, path, 'service', (body) => {
    const parsed = moderationQueueSchema.safeParse(body);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
  });
}

router.get('/reports', readRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, '/api/v1/community/reports', 'session').catch(next);
});
router.get('/appeals/:id', readRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/api/v1/community/appeals/${encodeURIComponent(req.params.id)}`, 'session').catch(next);
});
router.get('/report-reasons', readRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, '/internal/v1/report-reasons', 'service').catch(next);
});
router.post('/comments/:id/reports', commentReportRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/reports`, 'service').catch(next);
});
router.delete('/reports/:id', commentReportRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/reports/${encodeURIComponent(req.params.id)}`, 'service').catch(next);
});
router.post('/decisions/:id/appeals', commentAppealRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/moderation/decisions/${encodeURIComponent(req.params.id)}/appeals`, 'service').catch(next);
});

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
