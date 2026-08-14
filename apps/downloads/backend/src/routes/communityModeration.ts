import { Router, type Request, type Response } from 'express';
import { fetch as undiciFetch } from 'undici';
import { moderationQueueSchema } from '@artificio/comments';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
const moderatorOnly = [authMiddleware, requireRole(['moderator', 'admin'])];
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

async function proxyAccounts(
  req: Request,
  res: Response,
  path: string,
  mode: UpstreamMode,
): Promise<void> {
  const origin = accountsOrigin();
  const credential = process.env.SERVICE_CREDENTIAL?.trim();
  if (!origin || (mode === 'service' && !credential)) {
    res.status(503).json({ error: 'community_moderation_unavailable' });
    return;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (mode === 'service') {
    headers['X-Service-Token'] = credential!;
    headers['X-Acting-User-Id'] = req.user!.userId;
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
    res.status(response.status).json(body);
  } catch {
    res.status(503).json({ error: 'community_moderation_unavailable' });
  }
}

async function proxyQueue(req: Request, res: Response, path: string): Promise<void> {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 400) {
      const parsed = moderationQueueSchema.safeParse(body);
      if (!parsed.success) {
        res.status(502);
        return originalJson({ error: 'invalid_accounts_response' });
      }
      return originalJson(parsed.data);
    }
    return originalJson(body);
  }) as Response['json'];
  await proxyAccounts(req, res, path, 'service');
}

router.get('/reports', authMiddleware, (req: Request, res: Response) => {
  void proxyAccounts(req, res, '/api/v1/community/reports', 'session');
});
router.get('/appeals/:id', authMiddleware, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/api/v1/community/appeals/${encodeURIComponent(req.params.id)}`, 'session');
});
router.get('/report-reasons', authMiddleware, (req: Request, res: Response) => {
  void proxyAccounts(req, res, '/internal/v1/report-reasons', 'service');
});
router.post('/comments/:id/reports', authMiddleware, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/reports`, 'service');
});
router.delete('/reports/:id', authMiddleware, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/reports/${encodeURIComponent(req.params.id)}`, 'service');
});
router.post('/decisions/:id/appeals', authMiddleware, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/decisions/${encodeURIComponent(req.params.id)}/appeals`, 'service');
});

router.get('/moderation/queue', moderatorOnly, (req: Request, res: Response) => {
  const query = filteredQuery(req, ['source_app', 'status', 'max_priority', 'limit', 'cursor_opened_at', 'cursor_id']);
  void proxyQueue(req, res, `/internal/v1/comments/moderation-queue${query}`);
});
router.get('/moderation/log', moderatorOnly, (req: Request, res: Response) => {
  const query = filteredQuery(req, ['limit', 'cursor_occurred_at', 'cursor_id']);
  void proxyAccounts(req, res, `/internal/v1/comments/moderation-log${query}`, 'service');
});
router.get('/moderation/comments/:id/versions', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/versions`, 'service');
});
router.post('/moderation/comments/:id/removal', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/removal`, 'service');
});
router.post('/moderation/comments/:id/restore', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/restore`, 'service');
});
router.get('/moderation/cases/:id', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}`, 'service');
});
router.post('/moderation/cases/:id/resolution', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}/resolution`, 'service');
});
router.post('/moderation/cases/:id/reopen', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}/reopen`, 'service');
});
router.patch('/moderation/cases/:id/priority', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/cases/${encodeURIComponent(req.params.id)}/priority`, 'service');
});
router.get('/moderation/appeals/:id', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/appeals/${encodeURIComponent(req.params.id)}`, 'service');
});
router.post('/moderation/appeals/:id/resolution', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/appeals/${encodeURIComponent(req.params.id)}/resolution`, 'service');
});
router.get('/moderation/sanctions', moderatorOnly, (req: Request, res: Response) => {
  const query = filteredQuery(req, ['actor_id']);
  void proxyAccounts(req, res, `/internal/v1/moderation/sanctions${query}`, 'service');
});
router.post('/moderation/sanctions', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, '/internal/v1/moderation/sanctions', 'service');
});
router.delete('/moderation/sanctions/:id', moderatorOnly, (req: Request, res: Response) => {
  void proxyAccounts(req, res, `/internal/v1/moderation/sanctions/${encodeURIComponent(req.params.id)}`, 'service');
});

export default router;
