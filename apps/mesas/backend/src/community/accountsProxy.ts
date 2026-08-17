import type { Request } from 'express';
import type { AuthenticatedRequest } from '@artificio/auth';
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
 * Ligação do `mesas` ao transporte compartilhado das fachadas comunitárias
 * (`routes/communityComments.ts` e `routes/communityModeration.ts`).
 *
 * A mecânica inteira — headers, credencial, `Retry-After`, degradação,
 * validação de corpo e a tradução `req`/`res` — vive em `facadeRelay.ts` no
 * pacote. Aqui ficam **só as três coisas que este app não compartilha com o
 * `downloads`**: de onde vem o ator, qual `fetch` usar e como ler a origem.
 *
 * A primeira unificação deixou 69 linhas ainda idênticas entre os dois apps
 * (Sonar, PR #268) — a tradução, que dependia apenas destes parâmetros e
 * portanto não protegia diferença nenhuma. É a mesma camada que já cobrou preço
 * duas vezes no repo: `downloads` e `site` mantiveram hosts paralelos até a PR
 * #264 e duas correções de review aplicadas num nunca chegaram ao outro.
 */

export type UpstreamMode = FacadeRelayMode;
export type UpstreamValidation = FacadeRelayValidation;
export type ProxyOptions = FacadeProxyOptions;

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

/**
 * `fetch` global, e não `undici`: este app não traz `undici` como dependência
 * direta — é a única divergência de transporte em relação ao `downloads`.
 *
 * Resolvido **na chamada** (`(...args) => fetch(...)`), nunca capturado como
 * `fetchImpl: fetch` no import: a referência congelaria no valor que existia
 * quando o módulo foi carregado, e qualquer substituição posterior do global
 * deixaria de valer. Os testes trocam `fetch` por `vi.stubGlobal` depois do
 * import e passariam a bater na rede de verdade.
 */
export const proxyToAccounts = createFacadeProxy({
  fetchImpl: (url, init) => fetch(url, init as RequestInit) as unknown as ReturnType<FacadeRelayFetch>,
  origin: accountsOrigin,
  credential: () => process.env.SERVICE_CREDENTIAL?.trim(),
});

/** Ver `filteredQuery` do pacote — aqui só extrai a query do Express. */
export function filteredQuery(req: Request, allowed: readonly string[]): string {
  return filteredQueryCore(req.query as Record<string, unknown>, allowed);
}
