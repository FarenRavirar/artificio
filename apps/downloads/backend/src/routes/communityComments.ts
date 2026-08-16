import { Router, type Request, type Response, type NextFunction } from 'express';
import { fetch as undiciFetch } from 'undici';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimit';
import {
  DOWNLOADS_SUBJECT_TYPE,
  createMaterialSubjectGuard,
} from '../community/materialSubjectGuard';

/**
 * T5.3/T5.3c (spec 090) — fachada browser-safe da conversa do `downloads`.
 *
 * ## Por que uma fachada, e não o navegador falando com o `accounts.`
 *
 * Requisito 6a: **o navegador nunca chama `/internal/v1`**. A credencial de
 * serviço vive só aqui, e a escrita é backend-to-backend porque referência
 * opaca não substitui autorização por objeto — quem afirma que o material
 * existe, está visível e aceita comentário é este backend, a cada request
 * (`contrato-http-v1.md` §8, OWASP IDOR).
 *
 * ## Mesmo molde de `communityModeration.ts`, de propósito
 *
 * Proxy transparente: repassa corpo e status dos dois lados. Quem valida o
 * payload contra os schemas do pacote é o **frontend**
 * (`conversationCommentSchema`, `commentsThreadSchema` — ambos `.strict()`),
 * como já acontece em `useCommunityModeration.ts`. Traduzir shape aqui criaria
 * um segundo contrato para o mesmo dado, que divergiria na primeira mudança.
 *
 * ## Degradação (requisito 22c)
 *
 * A distinção leitura/escrita **não** é um campo de resposta inventado aqui: o
 * `CommentsResource` do pacote guarda a última leitura boa e degrada para
 * `stale`/`unavailable` sozinho quando a chamada falha. Esta fachada só precisa
 * falhar de forma honesta — `503` quando o `accounts.` não responde, `502`
 * quando responde coisa que não é JSON — e nunca inventar `2xx` numa escrita.
 */

const router = Router();
const subjectGuard = createMaterialSubjectGuard();
const REQUEST_TIMEOUT_MS = 5_000;

function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

const isBodyless = (method: string): boolean => ['GET', 'HEAD'].includes(method.toUpperCase());

/**
 * `X-Correlation-Id` do chamador (`contrato-http-v1.md` §1.1: opcional, ASCII
 * ≤128, "ecoado em toda resposta de erro").
 *
 * Sem ele, o `503` desta fachada e a linha de log correspondente não têm como
 * ser amarrados à requisição que o usuário viu falhar — é a diferença entre
 * "alguém teve erro hoje" e "esta requisição falhou aqui". O `accounts.` já o
 * ecoa (`communityCommentRoutes.ts:93-99`); a fachada propaga o mesmo valor,
 * para que as duas pontas apareçam com o mesmo id.
 *
 * Nulo quando ausente ou fora do formato, nunca um id inventado: um valor
 * gerado aqui não existiria em log nenhum do cliente e só poluiria a busca.
 */
export function readCorrelationId(header: string | undefined): string | null {
  if (typeof header !== 'string' || header.length === 0 || header.length > 128) return null;
  // ASCII imprimível: header com caractere de controle vai para log e response
  // splitting é o risco clássico dessa combinação.
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

  // A chave vem do CLIENTE, e não é gerada aqui: chave inventada por
  // requisição não sobrevive à retentativa, que é justamente o caso que ela
  // existe para cobrir — envio que dá timeout depois de o servidor confirmar a
  // escrita. Reenviar com chave nova duplica a fala; com a mesma, o `accounts.`
  // devolve a resposta original (§6, e o comentário de `transport.ts:59-68`).
  const idempotencyKey = req.header('idempotency-key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  // Propagado para que o erro do `accounts.` volte com o MESMO id que esta
  // fachada registra no log — as duas pontas amarradas por um valor só.
  if (correlation) headers['X-Correlation-Id'] = correlation;

  try {
    const response = await undiciFetch(`${origin}${path}`, {
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

    res.status(response.status).json(payload);
  } catch (error) {
    // Log antes de responder: `503` é indistinguível entre `accounts.` fora,
    // timeout e DNS quebrado, e sem rastro o diagnóstico na VM começa do zero
    // (mesma razão de `communityModeration.ts:144-149`).
    console.error('[community-comments] falha ao falar com accounts', {
      path,
      correlation_id: correlation,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({ error: 'community_comments_unavailable', correlation_id: correlation });
  }
}

/**
 * Resolve o assunto e recalcula a autorização. Os três motivos de recusa
 * colapsam em `404` uniforme, como o `accounts.` faz (§8): distinguir "existe
 * mas está oculto" de "não existe" devolveria um oráculo de existência sobre
 * material em rascunho.
 */
async function authorizeSubject(
  materialId: unknown,
  actingUserId: string,
  res: Response,
): Promise<{ subjectId: string; canonicalPath: string; ownerUserId: string | null } | null> {
  if (typeof materialId !== 'string' || !materialId.trim()) {
    res.status(400).json({ error: 'invalid_body', detail: 'subject_id ausente.' });
    return null;
  }

  const result = await subjectGuard(
    { subjectType: DOWNLOADS_SUBJECT_TYPE, subjectId: materialId },
    actingUserId,
  );

  if (!result.authorized) {
    res.status(404).json({ error: 'subject_not_found' });
    return null;
  }

  return {
    subjectId: materialId,
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
 * num ponto só (§8, "não se espalha por camada").
 */
function writeBody(
  subject: { subjectId: string; canonicalPath: string; ownerUserId: string | null },
  bodyMarkdown: unknown,
): Record<string, unknown> {
  return {
    subject_type: DOWNLOADS_SUBJECT_TYPE,
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
router.get('/', readRateLimiter, optionalAuth, (req: Request, res: Response, next: NextFunction) => {
  const subjectId = typeof req.query.subject_id === 'string' ? req.query.subject_id : '';
  if (!subjectId) {
    res.status(400).json({ error: 'invalid_query', detail: 'subject_id é obrigatório.' });
    return;
  }

  const query = new URLSearchParams({
    subject_type: DOWNLOADS_SUBJECT_TYPE,
    subject_id: subjectId,
  });
  // `sort` e `cursor` passam adiante sem interpretação: o vocabulário é do
  // `accounts.` (§2), e validar aqui criaria uma segunda lista de sorts para
  // divergir da dele.
  if (typeof req.query.sort === 'string') query.set('sort', req.query.sort);
  if (typeof req.query.cursor === 'string') query.set('cursor', req.query.cursor);

  proxyAccounts(req, res, `/internal/v1/comments?${query.toString()}`, {
    actingUserId: req.user?.userId,
  }).catch(next);
});

/** Criação de comentário raiz (§3). */
router.post('/', writeRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const actingUserId = req.user!.userId;
    const subject = await authorizeSubject(req.body?.subject_id, actingUserId, res);
    if (!subject) return;

    await proxyAccounts(req, res, '/internal/v1/comments', {
      actingUserId,
      body: writeBody(subject, req.body?.body_markdown),
    });
  })().catch(next);
});

/** Resposta. O `:id` é o pai; `root_id` e `depth` são calculados lá (§3). */
router.post('/:id/replies', writeRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const actingUserId = req.user!.userId;
    const subject = await authorizeSubject(req.body?.subject_id, actingUserId, res);
    if (!subject) return;

    await proxyAccounts(
      req,
      res,
      `/internal/v1/comments/${encodeURIComponent(req.params.id)}/replies`,
      { actingUserId, body: writeBody(subject, req.body?.body_markdown) },
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
router.patch('/:id', writeRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
    actingUserId: req.user!.userId,
    body: { body_markdown: req.body?.body_markdown },
  }).catch(next);
});

router.delete('/:id', writeRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
    actingUserId: req.user!.userId,
  }).catch(next);
});

/** Voto: estado absoluto, sem `Idempotency-Key` por construção (§7, decisão 12). */
router.put('/:id/vote', writeRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/vote`, {
    actingUserId: req.user!.userId,
    body: { value: req.body?.value },
  }).catch(next);
});

export default router;
