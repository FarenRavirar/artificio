import { Router, type Request, type Response, type NextFunction } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimit';
import {
  DOWNLOADS_SUBJECT_TYPE,
  createMaterialSubjectGuard,
} from '../community/materialSubjectGuard';
import { proxyToAccounts, readClientHeader } from '../community/accountsProxy';

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
/**
 * Vocabulário de erro desta fachada. A mecânica de transporte (credencial,
 * headers validados, `Retry-After`, degradação) vive em
 * `community/accountsProxy.ts`, compartilhada com a fachada de moderação —
 * manter duas cópias da camada que decide credencial e ator foi como esta
 * superfície e a do `site` perderam duas correções de review antes da PR #264.
 */
const UNAVAILABLE_ERROR = 'community_comments_unavailable';

/** Repasse ao `accounts.` com a credencial de serviço deste app. */
function proxyAccounts(
  req: Request,
  res: Response,
  path: string,
  options: { actingUserId?: string; body?: unknown } = {},
): Promise<void> {
  return proxyToAccounts(req, res, path, {
    mode: 'service',
    unavailableError: UNAVAILABLE_ERROR,
    logPrefix: 'community-comments',
    actingUserId: options.actingUserId,
    body: options.body,
  });
}

/**
 * Reexportado porque o teste exercita a validação de header diretamente: o Node
 * recusa header com caractere de controle antes de chegar ao handler, então o
 * ramo só é alcançável pela função.
 */
export { readClientHeader as readCorrelationId };

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
  void (async () => {
    const subjectId = typeof req.query.subject_id === 'string' ? req.query.subject_id : '';
    if (!subjectId) {
      res.status(400).json({ error: 'invalid_query', detail: 'subject_id é obrigatório.' });
      return;
    }

    // A LEITURA também passa pelo guard, e não só a escrita (achado de review,
    // PR #264 — o mesmo defeito existia no `site` e foi corrigido lá primeiro).
    //
    // Sem isto, `?subject_id=<id de material em rascunho>` confirmava a
    // existência do material pela diferença entre `200` com árvore vazia e
    // `404` — oráculo de existência sobre conteúdo não publicado, que é
    // exatamente o que o `404` uniforme existe para fechar (§8). Vale mesmo
    // quando não há comentário nenhum: o que vaza é o id ser válido.
    //
    // Aqui, diferente do `site`, o guard **distingue quem pergunta**: o criador
    // enxerga o próprio material em rascunho (`materialSubjectGuard.ts`,
    // `visibleOnlyToActor`). Em leitura anônima o ator vem vazio, e o guard
    // recusa como não-visível — que é o comportamento correto.
    const guard = await subjectGuard(
      { subjectType: DOWNLOADS_SUBJECT_TYPE, subjectId },
      req.user?.userId ?? '',
    );
    if (!guard.authorized) {
      res.status(404).json({ error: 'subject_not_found' });
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

    await proxyAccounts(req, res, `/internal/v1/comments?${query.toString()}`, {
      actingUserId: req.user?.userId,
    });
  })().catch(next);
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
