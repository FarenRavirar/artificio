import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, type AuthenticatedRequest } from "@artificio/auth";
import { optionalAuth } from "./community/optionalAuth.js";
import {
  SITE_SUBJECT_TYPE,
  createPostSubjectGuard,
} from "./community/postSubjectGuard.js";
import type { CommentSubjectGuard } from "@artificio/comments";

/**
 * T6.4 (spec 090) — fachada browser-safe da conversa do `site`.
 *
 * ## Por que uma fachada, e não o navegador falando com o `accounts.`
 *
 * Requisito 6a: **o navegador nunca chama `/internal/v1`**. A credencial de
 * serviço vive só aqui, e a escrita é backend-to-backend porque referência
 * opaca não substitui autorização por objeto — quem afirma que o post existe,
 * está publicado e aceita comentário é este backend, a cada request
 * (`contrato-http-v1.md` §8, OWASP IDOR).
 *
 * ## Mesmo molde de `downloads/backend/src/routes/communityComments.ts`
 *
 * Proxy transparente: repassa corpo e status dos dois lados. Quem valida o
 * payload contra os schemas do pacote é o **cliente** (`commentsThreadSchema`,
 * `mutatedCommentSchema` — ambos `.strict()`). Traduzir shape aqui criaria um
 * segundo contrato para o mesmo dado, que divergiria na primeira mudança.
 *
 * ## O que o blog SSG muda, e o que não muda
 *
 * A página do post é estática (`getStaticPaths`, `astro.config.mjs`); esta
 * fachada roda no servidor Express que já serve `/api/catalog/v1` e o admin. A
 * ilha React fala com ela em same-origin — por isso a CSP do site
 * (`connect-src 'self'`) já cobre a conversa sem alteração nenhuma.
 */

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Orçamentos separados para leitura e escrita (achado CodeQL, PR #264).
 *
 * O `globalLimiter` do servidor (`server.ts:36` — 300/min) não basta: ele conta
 * **todas** as rotas do `site` no mesmo balde, então uma rajada de escrita de
 * comentário consumiria o orçamento da navegação do blog, e vice-versa. Pior,
 * um único balde deixa escrita e leitura com o mesmo teto, quando publicar
 * comentário tem custo e risco de abuso muito maiores que ler a árvore.
 *
 * Os números são os mesmos da fachada equivalente do `downloads`
 * (`backend/src/middleware/rateLimit.ts`), para que o mesmo comportamento de
 * abuso encontre a mesma resposta nos dois módulos — divergir aqui criaria um
 * caminho mais frouxo para o mesmo ataque.
 *
 * Isto **não substitui** o rate limit do `accounts.`, que é quem protege o
 * registro central e responde `429` com `Retry-After`. Esta camada evita que a
 * rajada sequer atravesse a fachada e gaste o orçamento de credencial de
 * serviço do módulo inteiro.
 */
const readRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { error: "rate_limited", detail: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: { error: "rate_limited", detail: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

const isBodyless = (method: string): boolean => ["GET", "HEAD"].includes(method.toUpperCase());

/**
 * `X-Correlation-Id` do chamador (`contrato-http-v1.md` §1.1: opcional, ASCII
 * ≤128, "ecoado em toda resposta de erro").
 *
 * Sem ele, o `503` desta fachada e a linha de log correspondente não têm como
 * ser amarrados à requisição que o usuário viu falhar. Nulo quando ausente ou
 * fora do formato, nunca um id inventado: valor gerado aqui não existiria em
 * log nenhum do cliente e só poluiria a busca.
 */
export function readCorrelationId(header: string | undefined): string | null {
  if (typeof header !== "string" || header.length === 0 || header.length > 128) return null;
  // ASCII imprimível: header com caractere de controle vai para log e response
  // splitting é o risco clássico dessa combinação.
  return /^[\x20-\x7E]+$/.test(header) ? header : null;
}

const actingUserIdOf = (req: Request): string | undefined =>
  (req as AuthenticatedRequest).session?.user.id;

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
  const correlation = readCorrelationId(req.header("x-correlation-id"));
  if (!origin || !credential) {
    res.status(503).json({ error: "community_comments_unavailable", correlation_id: correlation });
    return;
  }

  const method = req.method.toUpperCase();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Service-Token": credential,
  };
  if (options.actingUserId) headers["X-Acting-User-Id"] = options.actingUserId;
  if (!isBodyless(method)) headers["Content-Type"] = "application/json";

  // A chave vem do CLIENTE, e não é gerada aqui: chave inventada por requisição
  // não sobrevive à retentativa, que é justamente o caso que ela existe para
  // cobrir — envio que dá timeout depois de o servidor confirmar a escrita.
  // Reenviar com chave nova duplica a fala; com a mesma, o `accounts.` devolve a
  // resposta original (§6).
  const idempotencyKey = req.header("idempotency-key");
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (correlation) headers["X-Correlation-Id"] = correlation;

  try {
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
      res.status(502).json({ error: "invalid_accounts_response", correlation_id: correlation });
      return;
    }

    // `Retry-After` atravessa a fachada: é o único header do `accounts.` que
    // carrega instrução operacional para o cliente. Sem ele, um `429` chega ao
    // navegador sem dizer **quando** tentar de novo, e a retentativa vira chute
    // que realimenta o próprio rate limit.
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);

    res.status(response.status).json(payload);
  } catch (error) {
    // Log antes de responder: `503` é indistinguível entre `accounts.` fora,
    // timeout e DNS quebrado, e sem rastro o diagnóstico na VM começa do zero.
    console.error("[community] falha ao falar com accounts", {
      path,
      correlation_id: correlation,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({ error: "community_comments_unavailable", correlation_id: correlation });
  }
}

/**
 * Corpo da escrita, montado **aqui** a partir da afirmação do guard.
 *
 * Nada de `subject_authorization`, `canonical_path` ou `owner_user_id` vindos do
 * cliente é aproveitado: o navegador inventaria dono e badge, e o `accounts.`
 * não teria como saber. A conversão camelCase→snake_case acontece num ponto só
 * (§8, "não se espalha por camada").
 */
function writeBody(
  subject: { subjectId: string; canonicalPath: string; ownerUserId: string | null },
  bodyMarkdown: unknown,
): Record<string, unknown> {
  return {
    subject_type: SITE_SUBJECT_TYPE,
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

/**
 * Monta a fachada. O guard entra por parâmetro para o teste exercitar
 * visibilidade sem subir banco.
 */
export function communityApi(subjectGuard: CommentSubjectGuard = createPostSubjectGuard()): Router {
  const r = Router();

  /**
   * Resolve o assunto e recalcula a autorização. Os motivos de recusa colapsam
   * em `404` uniforme, como o `accounts.` faz (§8): distinguir "existe mas está
   * oculto" de "não existe" devolveria um oráculo de existência sobre rascunho.
   */
  async function authorizeSubject(
    postId: unknown,
    actingUserId: string,
    res: Response,
  ): Promise<{ subjectId: string; canonicalPath: string; ownerUserId: string | null } | null> {
    if (typeof postId !== "string" || !postId.trim()) {
      res.status(400).json({ error: "invalid_body", detail: "subject_id ausente." });
      return null;
    }

    const result = await subjectGuard({ subjectType: SITE_SUBJECT_TYPE, subjectId: postId }, actingUserId);

    if (!result.authorized) {
      res.status(404).json({ error: "subject_not_found" });
      return null;
    }

    return {
      subjectId: postId,
      canonicalPath: result.authorization.canonicalPath,
      ownerUserId: result.authorization.ownerUserId,
    };
  }

  /** Leitura da árvore. Pública; com sessão, o ator vai junto para `my_vote` (§2). */
  r.get("/", readRateLimiter, optionalAuth, (req: Request, res: Response, next: NextFunction) => {
    const subjectId = typeof req.query.subject_id === "string" ? req.query.subject_id : "";
    if (!subjectId) {
      res.status(400).json({ error: "invalid_query", detail: "subject_id é obrigatório." });
      return;
    }

    const query = new URLSearchParams({
      subject_type: SITE_SUBJECT_TYPE,
      subject_id: subjectId,
    });
    // `sort` e `cursor` passam adiante sem interpretação: o vocabulário é do
    // `accounts.` (§2), e validar aqui criaria uma segunda lista de sorts para
    // divergir da dele.
    if (typeof req.query.sort === "string") query.set("sort", req.query.sort);
    if (typeof req.query.cursor === "string") query.set("cursor", req.query.cursor);

    proxyAccounts(req, res, `/internal/v1/comments?${query.toString()}`, {
      actingUserId: actingUserIdOf(req),
    }).catch(next);
  });

  /** Criação de comentário raiz (§3). */
  r.post("/", writeRateLimiter, requireAuth, (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const actingUserId = actingUserIdOf(req)!;
      const subject = await authorizeSubject(req.body?.subject_id, actingUserId, res);
      if (!subject) return;

      await proxyAccounts(req, res, "/internal/v1/comments", {
        actingUserId,
        body: writeBody(subject, req.body?.body_markdown),
      });
    })().catch(next);
  });

  /** Resposta. O `:id` é o pai; `root_id` e `depth` são calculados lá (§3). */
  r.post("/:id/replies", writeRateLimiter, requireAuth, (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const actingUserId = actingUserIdOf(req)!;
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
  r.patch("/:id", writeRateLimiter, requireAuth, (req: Request, res: Response, next: NextFunction) => {
    proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
      actingUserId: actingUserIdOf(req)!,
      body: { body_markdown: req.body?.body_markdown },
    }).catch(next);
  });

  r.delete("/:id", writeRateLimiter, requireAuth, (req: Request, res: Response, next: NextFunction) => {
    proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}`, {
      actingUserId: actingUserIdOf(req)!,
    }).catch(next);
  });

  /** Voto: estado absoluto, sem `Idempotency-Key` por construção (§7, decisão 12). */
  r.put("/:id/vote", writeRateLimiter, requireAuth, (req: Request, res: Response, next: NextFunction) => {
    proxyAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/vote`, {
      actingUserId: actingUserIdOf(req)!,
      body: { value: req.body?.value },
    }).catch(next);
  });

  return r;
}
