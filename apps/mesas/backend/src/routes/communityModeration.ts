import { Router, type Request, type Response, type NextFunction } from 'express';
import { moderationQueueSchema } from '@artificio/comments';
import type { AuthenticatedRequest } from '@artificio/auth';
import { authMiddleware } from '../middleware/auth.js';
import { publicRateLimiter, strictRateLimiter } from '../middleware/rateLimit.js';

/**
 * T7.7 (spec 090) — fachada de moderação de comentário do `mesas`.
 *
 * Comentário em mesa é conteúdo público, então a mesma moderação global que
 * cobre `downloads` e `site` precisa alcançá-lo. Molde de
 * `downloads/routes/communityModeration.ts`, com **uma diferença que não é
 * cosmética** — ver `requireCommentModerator` abaixo.
 */

const router = Router();
const REQUEST_TIMEOUT_MS = 5_000;

type UpstreamMode = 'service' | 'session';

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
// "todos os buckets aplicáveis precisam liberar"). Leitura e escrita usam
// buckets separados: o orçamento de listar fila não pode ser consumido por quem
// só remove comentário, e vice-versa.
const moderatorRead = [authMiddleware, requireCommentModerator, publicRateLimiter];
const moderatorWrite = [authMiddleware, requireCommentModerator, strictRateLimiter];

function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

const isBodyless = (method: string): boolean => ['GET', 'HEAD'].includes(method.toUpperCase());

/**
 * Só os parâmetros nomeados atravessam. Repassar `req.query` inteiro deixaria o
 * cliente injetar filtro que o `accounts.` interpreta e esta fachada não
 * revisou.
 */
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

/**
 * O ator que o `accounts.` entende é o id **central** da sessão, não o UUID
 * local de `mesas.users` (`middleware/auth.ts:108`). Mesma razão de
 * `actingAccountsUserId` em `communityComments.ts` — aqui vale ainda mais: um
 * id trocado numa rota de moderação atribuiria a decisão à conta errada na
 * auditoria.
 */
function actingAccountsUserId(req: Request): string | undefined {
  return (req as unknown as AuthenticatedRequest).session?.user.id;
}

function upstreamHeaders(
  req: Request,
  mode: UpstreamMode,
  credential: string | undefined,
  actingUserId: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (mode === 'service') {
    // Não-nulos garantidos pelas guardas de `proxyAccounts`, que respondem
    // 503/401 antes de chegar aqui.
    headers['X-Service-Token'] = credential!;
    headers['X-Acting-User-Id'] = actingUserId!;
  } else {
    const authorization = req.header('authorization');
    const cookie = req.header('cookie');
    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;
  }

  if (!isBodyless(req.method)) headers['Content-Type'] = 'application/json';
  const idempotencyKey = req.header('idempotency-key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return headers;
}

async function relayUpstream(
  response: { status: number; ok: boolean; text: () => Promise<string> },
  res: Response,
  validate?: UpstreamValidation,
): Promise<void> {
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
}

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

  // Falha fechada e explícita: se a ordem dos middlewares mudar num refactor, o
  // acesso não-checado viraria `TypeError` dentro de um `void` — 500 opaco em
  // vez de erro tratado (achado de review, PR #262 no `downloads`).
  const actingUserId = actingAccountsUserId(req);
  if (mode === 'service' && !actingUserId) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const method = req.method.toUpperCase();
  const headers = upstreamHeaders(req, mode, credential, actingUserId);

  try {
    // `fetch` global do Node, como no resto deste app
    // (`services/adminSecrets.ts:51`).
    const response = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: isBodyless(method) ? undefined : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await relayUpstream(response, res, validate);
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
router.post('/comments/:id/reports', authMiddleware, strictRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/reports`, 'service').catch(next);
});
router.delete('/reports/:id', authMiddleware, strictRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/reports/${encodeURIComponent(req.params.id)}`, 'service').catch(next);
});
router.post('/decisions/:id/appeals', authMiddleware, strictRateLimiter, (req: Request, res: Response, next: NextFunction) => {
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
