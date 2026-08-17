import type { Request, Response } from 'express';
import { fetch as undiciFetch } from 'undici';
import {
  filteredQuery as filteredQueryCore,
  readClientHeader,
  relayToAccounts,
  type FacadeRelayFetch,
  type FacadeRelayMode,
  type FacadeRelayValidation,
} from '@artificio/comments';

/**
 * Adaptador Express → `@artificio/comments` das duas fachadas comunitárias do
 * `downloads` (`routes/communityComments.ts` e `routes/communityModeration.ts`).
 *
 * A mecânica de transporte (headers, credencial, `Retry-After`, degradação,
 * validação de corpo) vive em `facadeRelay.ts` no pacote, compartilhada com o
 * `mesas`: as duas cópias eram idênticas em 165 linhas (Sonar: 74,3% e 66,5%,
 * PR #268). O custo dessa duplicação não é estético e já se pagou duas vezes —
 * `downloads` e `site` mantiveram hosts de conversa paralelos até a PR #264 e
 * duas correções de review aplicadas num nunca chegaram ao outro; depois, a
 * moderação daqui ficou sem `Retry-After` e sem `correlation_id` no corpo de
 * erro, que a conversa já tinha.
 *
 * O que fica aqui é só o que **não** é comum: traduzir `req`/`res` do Express,
 * resolver o ator e escolher o `fetch`.
 */

export type UpstreamMode = FacadeRelayMode;
export type UpstreamValidation = FacadeRelayValidation;

export function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
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
      // `undici` explícito, e não o `fetch` global: é o transporte que este app
      // já usa para falar com o `accounts.` (`accountsClient.ts`).
      fetchImpl: undiciFetch as unknown as FacadeRelayFetch,
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
