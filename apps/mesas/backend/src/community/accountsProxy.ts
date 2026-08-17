import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '@artificio/auth';
import {
  filteredQuery as filteredQueryCore,
  readClientHeader,
  relayToAccounts,
  type FacadeRelayMode,
  type FacadeRelayValidation,
} from '@artificio/comments';

/**
 * Adaptador Express → `@artificio/comments` das duas fachadas comunitárias do
 * `mesas` (`routes/communityComments.ts` e `routes/communityModeration.ts`).
 *
 * A mecânica de transporte (headers, credencial, `Retry-After`, degradação,
 * validação de corpo) vive em `facadeRelay.ts` no pacote, compartilhada com o
 * `downloads`: as duas cópias eram idênticas em 165 linhas (Sonar: 74,3% e
 * 66,5%, PR #268), e é exatamente a camada onde correção pela metade já cobrou
 * preço no repo duas vezes.
 *
 * O que fica aqui é só o que **não** é comum: traduzir `req`/`res` do Express e
 * resolver o ator.
 */

export type UpstreamMode = FacadeRelayMode;
export type UpstreamValidation = FacadeRelayValidation;

export function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

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
 *
 * O acesso é validado campo a campo, e não só `session?.` (achado de review, PR
 * #268): o valor chega por `as unknown as`, fora do alcance do compilador —
 * `middleware/auth.ts:174` atribui um `Session` tipado, mas os testes escrevem
 * `{ session: unknown }`, então o shape não é garantido aqui. `session` sem
 * `user` viraria `TypeError` dentro do handler — `500` opaco no lugar da
 * leitura anônima que a ausência de ator deve produzir.
 */
export function actingAccountsUserId(req: Request): string | undefined {
  const session = (req as unknown as AuthenticatedRequest).session;
  const id = session?.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export { readClientHeader };

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
  /** `true` quando o modo `service` exige ator resolvido. */
  requireActingUser?: boolean;
}

/** Repassa ao `accounts.` e escreve a decisão do relay na resposta do Express. */
export async function proxyToAccounts(
  req: Request,
  res: Response,
  path: string,
  options: ProxyOptions,
): Promise<void> {
  const result = await relayToAccounts(
    {
      method: req.method,
      header: (name) => req.header(name),
      body: options.body ?? req.body,
    },
    path,
    {
      mode: options.mode,
      origin: accountsOrigin(),
      credential: process.env.SERVICE_CREDENTIAL?.trim(),
      unavailableError: options.unavailableError,
      actingUserId: options.actingUserId,
      requireActingUser: options.requireActingUser,
      validate: options.validate,
      // `fetch` global: o `mesas` não traz `undici` como dependência direta.
      fetchImpl: fetch,
    },
  );

  // Log antes de responder: `503` é indistinguível entre `accounts.` fora,
  // timeout e DNS quebrado, e sem rastro o diagnóstico na VM começa do zero.
  if (result.kind === 'error' && result.logged) {
    console.error(`[${options.logPrefix}] falha ao falar com accounts`, {
      path: result.logged.path,
      correlation_id: readClientHeader(req.header('x-correlation-id')),
      error: result.logged.error,
    });
  }

  // `Retry-After` só existe nos ramos relayados: o `503`/`401` decidido antes
  // da chamada não tem janela do `accounts.` para repassar.
  if (result.kind !== 'error' && result.retryAfter) {
    res.setHeader('Retry-After', result.retryAfter);
  }
  if (result.kind === 'empty') {
    res.status(result.status).end();
    return;
  }
  res.status(result.status).json(result.body);
}

/** Ver `filteredQuery` do pacote — aqui só extrai a query do Express. */
export function filteredQuery(req: Request, allowed: readonly string[]): string {
  return filteredQueryCore(req.query as Record<string, unknown>, allowed);
}
