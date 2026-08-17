import { Router, type Request, type Response, type NextFunction } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import {
  commentEditRateLimiter,
  commentVoteRateLimiter,
  commentWriteRateLimiter,
  publicRateLimiter,
} from '../middleware/rateLimit.js';
import {
  MESAS_SUBJECT_TYPE,
  createTableSubjectGuard,
} from '../community/tableSubjectGuard.js';
import { actingAccountsUserId, proxyToAccounts } from '../community/accountsProxy.js';

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
/**
 * Vocabulário de erro desta fachada. A mecânica de transporte (credencial,
 * headers validados, `Retry-After`, degradação) vive em
 * `community/accountsProxy.ts`, compartilhada com a fachada de moderação:
 * as duas nasceram copiando o mesmo molde do `downloads`, e manter duas cópias
 * da camada que decide credencial e ator é como `downloads` e `site` perderam
 * duas correções de review antes da PR #264.
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
export { readClientHeader as readCorrelationId } from '../community/accountsProxy.js';

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
router.post('/', commentWriteRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
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
router.post('/:id/replies', commentWriteRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
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
 *
 * **Mesa encerrada não bloqueia estas duas rotas, e isso é deliberado** (achado
 * de review recusado, PR #268). O requisito 26a limita **escrita nova** —
 * "revalidado a cada criação e a cada resposta" —, e editar é ato de *reparo*
 * da própria fala, não fala nova. Bloquear prenderia o autor a um texto com
 * erro numa mesa que encerrou, e a auto-retirada (`DELETE` abaixo, mesmo
 * bucket) cairia junto: o autor perderia o direito de retirar o que escreveu
 * exatamente quando não pode mais se explicar em resposta. O `downloads`, host
 * de referência já em produção, tem o mesmo desenho.
 */
router.patch('/:id', commentEditRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
    actingUserId: actingAccountsUserId(req),
    body: { body_markdown: req.body?.body_markdown },
  }).catch(next);
});

router.delete('/:id', commentEditRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
    actingUserId: actingAccountsUserId(req),
  }).catch(next);
});

/**
 * Voto: estado absoluto, sem `Idempotency-Key` por construção (§7, decisão 12).
 *
 * **O guard de assunto roda aqui, e não só na escrita de fala** (achado de
 * review, PR #268). A UI esconde o botão em mesa encerrada, mas esconder botão
 * não é autorização: quem conhece o id de um comentário chamaria esta rota
 * direto e continuaria mexendo no placar que o encerramento deveria congelar.
 *
 * O `accounts.` **não** tem como recusar por conta própria — `PUT
 * /internal/v1/comments/:id/vote` nem recebe `subject_authorization`
 * (`communityCommentRoutes.ts:221`), que só é exigida na criação de fala. Ele
 * não sabe o que é uma mesa nem que ela acabou. Logo, a única camada capaz de
 * impor a regra é esta.
 *
 * ## DÉBITO CONHECIDO: o congelamento não é imposto aqui — e por quê
 *
 * Fechar isto na fachada exigiria resolver "a que assunto pertence este
 * comentário". As quatro vias foram medidas, e nenhuma existe hoje:
 *
 * 1. **Perguntar ao `accounts.`** — nenhuma rota responde isso.
 *    `GET /internal/v1/comments` (`communityCommentRoutes.ts:154`) lista por
 *    `subject_id`; não há o inverso.
 * 2. **Exigir `subject_id` do cliente** — o pacote envia apenas `{ value }`
 *    (`useConversationHost.tsx:121-126`), então exigir quebraria todo voto nos
 *    três consumidores.
 * 3. **Aceitar `subject_id` opcionalmente** — pior que não validar: bastaria
 *    omitir o campo para contornar, criando aparência de controle onde não há.
 * 4. **Passar a asserção pelo contrato interno** — `voteBodySchema` é
 *    `.strict()` e aceita **só** `value` (`communityCommentRoutes.ts`), logo
 *    qualquer campo extra volta `400`. Mudar isso é mudar o `accounts.`.
 *
 * O `mesas` também não guarda vínculo local comentário→mesa: a fachada é
 * stateless por desenho, e o assunto vive só no registro central.
 *
 * O impacto real é limitado e vale medir antes de dimensionar a urgência: quem
 * conhece o id de um comentário de mesa encerrada pode alterar **o próprio
 * voto** nele. Não afeta fala nova (bloqueada pelo guard, aqui), nem moderação,
 * nem privacidade — o dano é o placar de uma conversa encerrada seguir se
 * movendo, que é justamente o que o congelamento pretende evitar.
 *
 * A correção pertence ao `accounts.`, que é quem sabe o assunto de cada
 * comentário: aceitar `subject_authorization` no voto, como já faz na criação
 * (`:496,543`). Isso é mudança na fase 2/3 e em três consumidores, não nesta
 * fachada. Registrado em `tasks.md` (T7.8) para decisão do mantenedor.
 */
router.put('/:id/vote', commentVoteRateLimiter, authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/vote`, {
    actingUserId: actingAccountsUserId(req),
    body: { value: req.body?.value },
  }).catch(next);
});

export default router;
