import type { Request } from 'express';
import { fetch as undiciFetch } from 'undici';
import {
  createFacadeProxy,
  filteredQuery as filteredQueryCore,
  readClientHeader,
  type FacadeProxyOptions,
  type FacadeRelayFetch,
  type FacadeRelayMode,
  type FacadeRelayValidation,
} from '@artificio/comments';

/**
 * Ligação do `downloads` ao transporte compartilhado das fachadas comunitárias
 * (`routes/communityComments.ts` e `routes/communityModeration.ts`).
 *
 * A mecânica inteira — headers, credencial, `Retry-After`, degradação,
 * validação de corpo e a tradução `req`/`res` — vive em `facadeRelay.ts` no
 * pacote. Aqui ficam **só as diferenças deste app**: qual `fetch` usar e como
 * ler a origem. O ator vem de `req.user.userId`, que neste app **já é** o id
 * central (diferente do `mesas`), então cada rota o passa direto.
 *
 * A primeira unificação deixou 69 linhas ainda idênticas entre os dois apps
 * (Sonar, PR #268) — a tradução, que dependia apenas destes parâmetros. É a
 * mesma camada que já cobrou preço duas vezes: hosts paralelos com `site` até a
 * PR #264, e depois a moderação daqui sem `Retry-After` nem `correlation_id`
 * que a conversa já tinha.
 */

export type UpstreamMode = FacadeRelayMode;
export type UpstreamValidation = FacadeRelayValidation;
export type ProxyOptions = FacadeProxyOptions;

export function accountsOrigin(): string | null {
  const value = process.env.ACCOUNTS_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

export { readClientHeader };

/**
 * `undici` explícito, e não o `fetch` global: é o transporte que este app já
 * usa para falar com o `accounts.` (`accountsClient.ts`).
 */
export const proxyToAccounts = createFacadeProxy({
  // Resolvido na chamada, e não capturado no import: a referência congelaria no
  // valor que existia quando o módulo carregou, e substituir o transporte
  // (instrumentação, mock) deixaria de valer.
  fetchImpl: (url: string, init) =>
    undiciFetch(url, init as never) as unknown as ReturnType<FacadeRelayFetch>,
  origin: accountsOrigin,
  credential: () => process.env.SERVICE_CREDENTIAL?.trim(),
});

/** Ver `filteredQuery` do pacote — aqui só extrai a query do Express. */
export function filteredQuery(req: Request, allowed: readonly string[]): string {
  return filteredQueryCore(req.query as Record<string, unknown>, allowed);
}
