import { Router, type Request, type Response, type NextFunction } from 'express';
import { fetch as undiciFetch } from 'undici';
import { moderationQueueSchema } from '@artificio/comments';
import { authMiddleware, requireRole } from '../middleware/auth';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Limiter na fachada, além do que o `accounts.` já aplica por usuário e
// credencial: a fachada é quem conhece o IP real do cliente (requisito 12b —
// "todos os buckets aplicáveis precisam liberar"), e sem ele um IP autenticado
// converte uma requisição barata daqui em carga no `accounts.`, que é o app
// sagrado do SSO. Achado do CodeQL na PR #262 (`js/missing-rate-limiting`, 20
// rotas): handler que decide autorização sem limite é alvo de força bruta de
// papel/ID. Leitura e escrita usam buckets separados — o orçamento de listar
// fila não pode ser consumido por quem só remove comentário, e vice-versa.
const moderatorRead = [authMiddleware, requireRole(['moderator', 'admin']), readRateLimiter];
const moderatorWrite = [authMiddleware, requireRole(['moderator', 'admin']), writeRateLimiter];
const REQUEST_TIMEOUT_MS = 5_000;

type UpstreamMode = 'service' | 'session';

function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

function filteredQuery(req: Request, allowed: readonly string[]): string {
  const query = new URLSearchParams();
  for (const key of allowed) {
    const value = req.query[key];
    if (typeof value === 'string') query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

type UpstreamValidation = (body: unknown) => { ok: true; data: unknown } | { ok: false };

async function proxyAccounts(
  req: Request,
  res: Response,
  path: string,
  mode: UpstreamMode,
  validate?: UpstreamValidation,
): Promise<void> {
  const origin = accountsOrigin();
  const credential = process.env.SERVICE_CREDENTIAL?.trim();
  if (!origin || (mode === 'service' && !credential)) {
    res.status(503).json({ error: 'community_moderation_unavailable' });
    return;
  }

  // `req.user` é opcional no tipo (`middleware/auth.ts:24`), e o `!` anterior
  // apostava que o `authMiddleware` sempre populou. Se a ordem dos middlewares
  // mudar num refactor, o `!` viraria `TypeError` dentro de um `void` — 500
  // opaco em vez de erro tratado. Falha fechada e explícita (achado de review,
  // PR #262).
  const actingUserId = req.user?.userId;
  if (mode === 'service' && !actingUserId) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (mode === 'service') {
    headers['X-Service-Token'] = credential!;
    headers['X-Acting-User-Id'] = actingUserId!;
  } else {
    const authorization = req.header('authorization');
    const cookie = req.header('cookie');
    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;
  }

  const method = req.method.toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) headers['Content-Type'] = 'application/json';
  const idempotencyKey = req.header('idempotency-key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  try {
    const response = await undiciFetch(`${origin}${path}`, {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        res.status(502).json({ error: 'invalid_accounts_response' });
        return;
      }
    }
    // A validação só se aplica à resposta de sucesso: corpo de erro do
    // `accounts.` tem shape próprio e passa adiante sem ser medido contra o
    // schema da rota.
    if (validate && response.ok) {
      const parsed = validate(body);
      if (!parsed.ok) {
        res.status(502).json({ error: 'invalid_accounts_response' });
        return;
      }
      res.status(response.status).json(parsed.data);
      return;
    }
    res.status(response.status).json(body);
  } catch (error) {
    // Log antes de responder: o `503` é indistinguível entre `accounts.` fora,
    // timeout e DNS quebrado, e sem rastro o diagnóstico começa do zero na VM.
    console.error('[community-moderation] falha ao falar com accounts', {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({ error: 'community_moderation_unavailable' });
  }
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

router.get('/reports', authMiddleware, readRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, '/api/v1/community/reports', 'session').catch(next);
});
router.get('/appeals/:id', authMiddleware, readRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/api/v1/community/appeals/${encodeURIComponent(req.params.id)}`, 'session').catch(next);
});
router.get('/report-reasons', authMiddleware, readRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, '/internal/v1/report-reasons', 'service').catch(next);
});
router.post('/comments/:id/reports', authMiddleware, writeRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/reports`, 'service').catch(next);
});
router.delete('/reports/:id', authMiddleware, writeRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/reports/${encodeURIComponent(req.params.id)}`, 'service').catch(next);
});
router.post('/decisions/:id/appeals', authMiddleware, writeRateLimiter, (req: Request, res: Response, next: NextFunction) => {
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
