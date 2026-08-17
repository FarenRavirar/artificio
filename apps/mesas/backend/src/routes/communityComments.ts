import { Router, type Request, type Response, type NextFunction } from 'express';
import type { AuthenticatedRequest } from '@artificio/auth';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { publicRateLimiter, strictRateLimiter } from '../middleware/rateLimit.js';
import {
  MESAS_SUBJECT_TYPE,
  createTableSubjectGuard,
} from '../community/tableSubjectGuard.js';

/**
 * T7.4/T7.5 (spec 090) — fachada browser-safe da conversa do `mesas`.
 *
 * ## Por que uma fachada, e não o navegador falando com o `accounts.`
 *
 * Requisito 6a: **o navegador nunca chama `/internal/v1`**. A credencial de
 * serviço vive só aqui, e a escrita é backend-to-backend porque referência
 * opaca não substitui autorização por objeto — quem afirma que a mesa existe,
 * está visível e aceita comentário é este backend, a cada request
 * (`contrato-http-v1.md` §8, OWASP IDOR).
 *
 * ## Namespace próprio (T7.5, requisito 26d)
 *
 * Estas rotas vivem sob `/api/v1/community/*` porque `/api/v1/notifications` já
 * é do feed administrativo do `mesas` (`server.ts:127`). Fusão dos dois só com
 * contrato explícito, se for pedida.
 *
 * ## Mesmo molde do `downloads` e do `site`, de propósito
 *
 * Proxy transparente: repassa corpo e status dos dois lados. Quem valida o
 * payload contra os schemas do pacote é o **frontend**. Traduzir shape aqui
 * criaria um segundo contrato para o mesmo dado, que divergiria na primeira
 * mudança.
 */

const router = Router();
const subjectGuard = createTableSubjectGuard();
const REQUEST_TIMEOUT_MS = 5_000;

function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

const isBodyless = (method: string): boolean => ['GET', 'HEAD'].includes(method.toUpperCase());

/**
 * **O identificador que o `accounts.` entende, e a razão de esta função existir
 * (T7.2, requisito 26c).**
 *
 * `req.user.userId` no `mesas` é `mesas.users.id` — UUID **local**, criado pelo
 * provisionamento em `middleware/auth.ts:108`. O `accounts.` identifica a conta
 * por `session.user.id`, que este app persiste em `users.google_id`. Os dois
 * são UUID e nenhum compilador distingue um do outro: copiar a fachada do
 * `downloads` — onde `req.user.userId` **já é** o id central
 * (`downloads/middleware/auth.ts:66`) — mandaria o valor errado e associaria a
 * fala a uma conta que não existe lá, sem erro em lugar nenhum.
 */
function actingAccountsUserId(req: Request): string | undefined {
  return (req as unknown as AuthenticatedRequest).session?.user.id;
}

/**
 * `X-Correlation-Id` do chamador (`contrato-http-v1.md` §1.1: opcional, ASCII
 * ≤128, ecoado em toda resposta de erro). Nulo quando ausente ou fora do
 * formato, nunca um id inventado: valor gerado aqui não existiria em log nenhum
 * do cliente e só poluiria a busca.
 */
export function readCorrelationId(header: string | undefined): string | null {
  if (typeof header !== 'string' || header.length === 0 || header.length > 128) return null;
  // ASCII imprimível: header com caractere de controle indo para log e response
  // é o risco clássico de response splitting.
  return /^[\x20-\x7E]+$/.test(header) ? header : null;
}

/**
 * Repassa ao `accounts.` com a credencial de serviço. `realm` e `source_app`
 * saem dela, nunca do payload (§1.1) — aceitar do corpo seria a porta para uma
 * credencial de beta escrever em produção.
 */
async function proxyAccounts(
  req: Request,
  res: Response,
  path: string,
  options: { actingUserId?: string; body?: unknown } = {},
): Promise<void> {
  const origin = accountsOrigin();
  const credential = process.env.SERVICE_CREDENTIAL?.trim();
  const correlation = readCorrelationId(req.header('x-correlation-id'));
  if (!origin || !credential) {
    res.status(503).json({ error: 'community_comments_unavailable', correlation_id: correlation });
    return;
  }

  const method = req.method.toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Service-Token': credential,
  };
  if (options.actingUserId) headers['X-Acting-User-Id'] = options.actingUserId;
  if (!isBodyless(method)) headers['Content-Type'] = 'application/json';

  // A chave vem do CLIENTE, e não é gerada aqui: chave inventada por requisição
  // não sobrevive à retentativa, que é justamente o caso que ela existe para
  // cobrir — envio que dá timeout depois de o servidor confirmar a escrita.
  const idempotencyKey = req.header('idempotency-key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (correlation) headers['X-Correlation-Id'] = correlation;

  try {
    // `fetch` global do Node, e não `undici` explícito como no `downloads`: é o
    // transporte que este app já usa para falar com o `accounts.`
    // (`services/adminSecrets.ts:51`), e trazer a lib só para esta rota
    // adicionaria dependência sem ganho — o `fetch` do Node É undici por baixo.
    const response = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: isBodyless(method) ? undefined : JSON.stringify(options.body ?? req.body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const text = await response.text();
    if (!text) {
      res.status(response.status).end();
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      // HTML de página de erro no lugar de JSON: vira `502` explícito, nunca
      // corpo repassado cru que o schema do cliente tentaria interpretar.
      res.status(502).json({ error: 'invalid_accounts_response', correlation_id: correlation });
      return;
    }

    // `Retry-After` atravessa a fachada: é o único header do `accounts.` que
    // carrega instrução operacional para o cliente. Sem ele, um `429` chega ao
    // navegador sem dizer **quando** tentar de novo, e a retentativa vira chute
    // que realimenta o próprio rate limit.
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);

    res.status(response.status).json(payload);
  } catch (error) {
    // Log antes de responder: `503` é indistinguível entre `accounts.` fora,
    // timeout e DNS quebrado, e sem rastro o diagnóstico na VM começa do zero.
    console.error('[community-comments] falha ao falar com accounts', {
      path,
      correlation_id: correlation,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({ error: 'community_comments_unavailable', correlation_id: correlation });
  }
}

/**
 * Resolve o assunto e recalcula a autorização. Os motivos de recusa colapsam em
 * `404` uniforme, como o `accounts.` faz (§8): distinguir "existe mas está
 * oculta" de "não existe" devolveria um oráculo de existência sobre mesa em
 * rascunho.
 */
async function authorizeSubject(
  tableId: unknown,
  res: Response,
): Promise<{ subjectId: string; canonicalPath: string; ownerUserId: string | null } | null> {
  if (typeof tableId !== 'string' || !tableId.trim()) {
    res.status(400).json({ error: 'invalid_body', detail: 'subject_id ausente.' });
    return null;
  }

  // O ator não entra: a visibilidade da mesa não depende de quem pergunta
  // (`tableSubjectGuard.ts`). O parâmetro existe na assinatura do contrato e é
  // passado vazio, como o `site` faz.
  const result = await subjectGuard({ subjectType: MESAS_SUBJECT_TYPE, subjectId: tableId }, '');

  if (!result.authorized) {
    res.status(404).json({ error: 'subject_not_found' });
    return null;
  }

  return {
    subjectId: tableId,
    canonicalPath: result.authorization.canonicalPath,
    ownerUserId: result.authorization.ownerUserId,
  };
}

/**
 * Corpo da escrita, montado **aqui** a partir da afirmação do guard.
 *
 * Nada de `subject_authorization`, `canonical_path` ou `owner_user_id` vindos
 * do cliente é aproveitado: o navegador inventaria dono e badge, e o
 * `accounts.` não teria como saber. A conversão camelCase→snake_case acontece
 * num ponto só (§8).
 */
function writeBody(
  subject: { subjectId: string; canonicalPath: string; ownerUserId: string | null },
  bodyMarkdown: unknown,
): Record<string, unknown> {
  return {
    subject_type: MESAS_SUBJECT_TYPE,
    subject_id: subject.subjectId,
    canonical_path: subject.canonicalPath,
    body_markdown: bodyMarkdown,
    subject_owner_user_id: subject.ownerUserId,
    subject_authorization: {
      exists: true,
      visible: true,
      commentable: true,
      owner_user_id: subject.ownerUserId,
      canonical_path: subject.canonicalPath,
    },
  };
}

/** Leitura da árvore. Pública; com sessão, o ator vai junto para `my_vote` (§2). */
router.get('/', publicRateLimiter, optionalAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const subjectId = typeof req.query.subject_id === 'string' ? req.query.subject_id : '';
    if (!subjectId) {
      res.status(400).json({ error: 'invalid_query', detail: 'subject_id é obrigatório.' });
      return;
    }

    // A LEITURA também passa pelo guard, e não só a escrita (achado da PR #264,
    // corrigido no `site` e depois no `downloads`). Sem isto,
    // `?subject_id=<id de mesa em rascunho>` confirmaria a existência da mesa
    // pela diferença entre `200` com árvore vazia e `404` — oráculo de
    // existência sobre conteúdo não publicado. Vale mesmo sem comentário
    // nenhum: o que vaza é o id ser válido.
    //
    // Aqui o guard recusa rascunho como `not_visible` e mesa encerrada como
    // `not_commentable` — e a leitura precisa aceitar a segunda. Por isso o
    // teste é sobre o motivo, não sobre `authorized`.
    const guard = await subjectGuard({ subjectType: MESAS_SUBJECT_TYPE, subjectId }, '');
    if (!guard.authorized && guard.reason !== 'not_commentable') {
      res.status(404).json({ error: 'subject_not_found' });
      return;
    }

    const query = new URLSearchParams({
      subject_type: MESAS_SUBJECT_TYPE,
      subject_id: subjectId,
    });
    // `sort` e `cursor` passam adiante sem interpretação: o vocabulário é do
    // `accounts.` (§2), e validar aqui criaria uma segunda lista de sorts para
    // divergir da dele.
    if (typeof req.query.sort === 'string') query.set('sort', req.query.sort);
    if (typeof req.query.cursor === 'string') query.set('cursor', req.query.cursor);

    await proxyAccounts(req, res, `/internal/v1/comments?${query.toString()}`, {
      actingUserId: actingAccountsUserId(req),
    });
  })().catch(next);
});

/** Criação de comentário raiz (§3). */
router.post('/', strictRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const subject = await authorizeSubject(req.body?.subject_id, res);
    if (!subject) return;

    await proxyAccounts(req, res, '/internal/v1/comments', {
      actingUserId: actingAccountsUserId(req),
      body: writeBody(subject, req.body?.body_markdown),
    });
  })().catch(next);
});

/** Resposta. O `:id` é o pai; `root_id` e `depth` são calculados lá (§3). */
router.post('/:id/replies', strictRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const subject = await authorizeSubject(req.body?.subject_id, res);
    if (!subject) return;

    await proxyAccounts(
      req,
      res,
      `/internal/v1/comments/${encodeURIComponent(req.params.id)}/replies`,
      { actingUserId: actingAccountsUserId(req), body: writeBody(subject, req.body?.body_markdown) },
    );
  })().catch(next);
});

/**
 * Edição e auto-retirada. **Sem guard de assunto**: a autorização que importa
 * aqui é de autoria, e ela é verificada no `accounts.` dentro da transação,
 * sobre a linha travada (§4). Escopo de credencial diz o que o app pode fazer,
 * nunca quem é o dono da fala — replicar a checagem aqui daria uma segunda
 * resposta para a mesma pergunta.
 */
router.patch('/:id', strictRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
    actingUserId: actingAccountsUserId(req),
    body: { body_markdown: req.body?.body_markdown },
  }).catch(next);
});

router.delete('/:id', strictRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
    actingUserId: actingAccountsUserId(req),
  }).catch(next);
});

/** Voto: estado absoluto, sem `Idempotency-Key` por construção (§7, decisão 12). */
router.put('/:id/vote', strictRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/vote`, {
    actingUserId: actingAccountsUserId(req),
    body: { value: req.body?.value },
  }).catch(next);
});

export default router;
