import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '@artificio/auth';

/**
 * Transporte compartilhado das duas fachadas comunitárias do `mesas`
 * (`routes/communityComments.ts` e `routes/communityModeration.ts`).
 *
 * ## Por que existe
 *
 * As duas fachadas nasceram copiando o molde do `downloads`, e com ele vieram
 * `accountsOrigin`, `isBodyless`, `actingAccountsUserId`, a validação de header
 * e a mecânica inteira de repasse — idênticas nos dois arquivos (Sonar mediu
 * 57% e 30,5% de duplicação, PR #268).
 *
 * O custo não é estético. Duplicação nesta camada específica é o que já cobrou
 * preço no monorepo: `downloads` e `site` mantiveram hosts de conversa
 * paralelos até a PR #264, e **duas correções de review aplicadas num nunca
 * chegaram ao outro**. Aqui a superfície duplicada decide credencial, ator e
 * degradação — exatamente onde uma correção que chega pela metade vira defeito
 * silencioso.
 *
 * ## O que fica de fora, de propósito
 *
 * O que é **política** de cada fachada não sobe para cá: guard de assunto,
 * guard de papel, escolha de bucket, validação de corpo e o vocabulário de
 * erro. Só a mecânica de transporte é comum; o resto é decisão de domínio, e
 * unificá-la esconderia diferenças que precisam ficar visíveis.
 */

/** Modo de autenticação da chamada ao `accounts.`. */
export type UpstreamMode = 'service' | 'session';

export const REQUEST_TIMEOUT_MS = 5_000;

export function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

export const isBodyless = (method: string): boolean =>
  ['GET', 'HEAD'].includes(method.toUpperCase());

/**
 * **O identificador que o `accounts.` entende (T7.2, requisito 26c).**
 *
 * `req.user.userId` no `mesas` é `mesas.users.id` — UUID **local**, criado pelo
 * provisionamento em `middleware/auth.ts`. O `accounts.` identifica a conta por
 * `session.user.id`, que este app persiste em `users.google_id`. Os dois são
 * UUID e nenhum compilador distingue um do outro: copiar a fachada do
 * `downloads` — onde `req.user.userId` **já é** o id central — mandaria o valor
 * errado e associaria a fala a uma conta que não existe lá, sem erro em lugar
 * nenhum.
 *
 * Nulo em leitura anônima, e o header simplesmente não é montado: mandar string
 * vazia faria o `accounts.` resolver `my_vote` para quem não pediu.
 */
export function actingAccountsUserId(req: Request): string | undefined {
  return (req as unknown as AuthenticatedRequest).session?.user.id;
}

/**
 * Valida header de texto vindo do cliente que será repassado ao `accounts.`.
 *
 * Nasceu para `X-Correlation-Id` (`contrato-http-v1.md` §1.1: opcional, ASCII
 * ≤128, ecoado em toda resposta de erro) e hoje guarda também
 * `Idempotency-Key`, que tem o mesmo formato e o mesmo risco. Nulo quando
 * ausente ou fora do formato, nunca um valor inventado: id gerado aqui não
 * existiria em log nenhum do cliente, e chave de idempotência inventada
 * quebraria a retentativa que ela existe para cobrir.
 */
export function readClientHeader(header: string | undefined): string | null {
  if (typeof header !== 'string' || header.length === 0 || header.length > 128) return null;
  // ASCII imprimível: header com caractere de controle indo para log e response
  // é o risco clássico de response splitting.
  return /^[\x20-\x7E]+$/.test(header) ? header : null;
}

/**
 * Monta os headers de saída. `realm` e `source_app` saem da credencial, nunca
 * do payload (§1.1) — aceitar do corpo seria a porta para uma credencial de
 * beta escrever em produção.
 */
export function upstreamHeaders(
  req: Request,
  mode: UpstreamMode,
  credential: string | undefined,
  actingUserId: string | undefined,
  correlation: string | null,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (mode === 'service') {
    // Não-nulos garantidos pelas guardas do chamador, que respondem 503/401
    // antes de chegar aqui.
    headers['X-Service-Token'] = credential!;
    if (actingUserId) headers['X-Acting-User-Id'] = actingUserId;
  } else {
    const authorization = req.header('authorization');
    const cookie = req.header('cookie');
    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;
  }

  if (!isBodyless(req.method)) headers['Content-Type'] = 'application/json';

  // A chave vem do CLIENTE, e não é gerada aqui: chave inventada por requisição
  // não sobrevive à retentativa, que é justamente o caso que ela existe para
  // cobrir — envio que dá timeout depois de o servidor confirmar a escrita.
  const idempotencyKey = readClientHeader(req.header('idempotency-key'));
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (correlation) headers['X-Correlation-Id'] = correlation;

  return headers;
}

/** Resposta mínima que o relay consome — o que `fetch` devolve. */
export interface UpstreamResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
}

export type UpstreamValidation = (
  body: unknown,
) => { ok: true; data: unknown } | { ok: false };

export interface ProxyOptions {
  mode: UpstreamMode;
  /** Vocabulário de erro da fachada — cada uma tem o seu. */
  unavailableError: string;
  /** Prefixo do log, para separar as duas superfícies na VM. */
  logPrefix: string;
  actingUserId?: string;
  /** Corpo já montado pela fachada; ausente usa `req.body`. */
  body?: unknown;
  validate?: UpstreamValidation;
  /** `true` quando o modo `service` exige ator resolvido (escrita). */
  requireActingUser?: boolean;
}

/**
 * Repassa ao `accounts.` e traduz a resposta.
 *
 * `Retry-After` atravessa em `429` e `503`: é o único header do `accounts.` com
 * instrução operacional para o cliente. Sem ele, um `429` chega ao navegador
 * sem dizer **quando** tentar de novo, e a retentativa vira chute que
 * realimenta o próprio rate limit.
 */
export async function proxyToAccounts(
  req: Request,
  res: Response,
  path: string,
  options: ProxyOptions,
): Promise<void> {
  const origin = accountsOrigin();
  const credential = process.env.SERVICE_CREDENTIAL?.trim();
  const correlation = readClientHeader(req.header('x-correlation-id'));

  if (!origin || (options.mode === 'service' && !credential)) {
    res.status(503).json({ error: options.unavailableError, correlation_id: correlation });
    return;
  }

  // Falha fechada e explícita: se a ordem dos middlewares mudar num refactor, o
  // acesso não-checado viraria `TypeError` dentro de um `void` — 500 opaco em
  // vez de erro tratado (achado de review, PR #262 no `downloads`).
  if (options.mode === 'service' && options.requireActingUser && !options.actingUserId) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const method = req.method.toUpperCase();
  const headers = upstreamHeaders(req, options.mode, credential, options.actingUserId, correlation);

  try {
    // `fetch` global do Node, e não `undici` explícito como no `downloads`: é o
    // transporte que este app já usa para falar com o `accounts.`
    // (`services/adminSecrets.ts`), e trazer a lib só para estas rotas
    // adicionaria dependência sem ganho — o `fetch` do Node É undici por baixo.
    const response = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: isBodyless(method) ? undefined : JSON.stringify(options.body ?? req.body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const retryAfter = response.headers.get('retry-after');
    if (retryAfter && (response.status === 429 || response.status === 503)) {
      res.setHeader('Retry-After', retryAfter);
    }

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

    // A validação só se aplica à resposta de sucesso: corpo de erro do
    // `accounts.` tem shape próprio e passa adiante sem ser medido contra o
    // schema da rota — validá-lo transformaria um `429` legível num `502` opaco.
    if (options.validate && response.ok) {
      const parsed = options.validate(payload);
      if (!parsed.ok) {
        res.status(502).json({ error: 'invalid_accounts_response', correlation_id: correlation });
        return;
      }
      res.status(response.status).json(parsed.data);
      return;
    }

    res.status(response.status).json(payload);
  } catch (error) {
    // Log antes de responder: `503` é indistinguível entre `accounts.` fora,
    // timeout e DNS quebrado, e sem rastro o diagnóstico na VM começa do zero.
    console.error(`[${options.logPrefix}] falha ao falar com accounts`, {
      path,
      correlation_id: correlation,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({ error: options.unavailableError, correlation_id: correlation });
  }
}

/**
 * Só os parâmetros nomeados atravessam. Repassar `req.query` inteiro deixaria o
 * cliente injetar filtro que o `accounts.` interpreta e a fachada não revisou.
 */
export function filteredQuery(req: Request, allowed: readonly string[]): string {
  const query = new URLSearchParams();
  for (const key of allowed) {
    const value = req.query[key];
    if (typeof value === 'string') query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}
