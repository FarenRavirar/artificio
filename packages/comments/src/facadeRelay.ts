/**
 * Transporte das fachadas de módulo → `accounts.` (T7.7).
 *
 * ## Por que mora aqui, e não em cada app
 *
 * Cada módulo que adota comentário expõe duas fachadas (conversa e moderação) e
 * as duas fazem a mesma coisa: montam headers a partir da credencial de
 * serviço, repassam ao registro central e traduzem a resposta. A PR #268
 * unificou isso **dentro** do `mesas` e **dentro** do `downloads`, e o Sonar
 * mediu o que sobrou: 165 linhas idênticas entre os dois `accountsProxy.ts`
 * (74,3% e 66,5%). Extrair por app resolveu metade do problema e deixou a outra
 * metade — a que atravessa apps — exatamente como estava.
 *
 * O custo dessa metade já foi cobrado duas vezes no repo, e é sempre o mesmo
 * defeito: `downloads` e `site` mantiveram hosts de conversa paralelos até a PR
 * #264 e **duas correções de review aplicadas num nunca chegaram ao outro**;
 * depois, na #268, a moderação do `downloads` estava sem `Retry-After` e sem
 * `correlation_id` no corpo de erro, que a conversa já tinha. Esta camada
 * decide credencial, ator e degradação — é onde uma correção pela metade vira
 * defeito silencioso em produção, não inconsistência estética.
 *
 * ## Não conhece `express`
 *
 * Mesma disciplina de `rateLimitBuckets.ts`: o pacote recebe dados neutros e
 * devolve uma decisão. Quem traduz `req`/`res` do Express é um adaptador de
 * ~30 linhas em cada app, que é também onde as diferenças legítimas ficam
 * visíveis em vez de escondidas atrás de uma flag:
 *
 * - **o ator** — no `mesas` é `session.user.id` (o id central, porque
 *   `req.user.userId` lá é UUID **local**); no `downloads`, `req.user.userId`
 *   já é o id central. Os dois são UUID e nenhum compilador distingue: trocar
 *   um pelo outro associaria a fala a uma conta que não existe, sem erro em
 *   lugar nenhum;
 * - **o `fetch`** — `undici` explícito no `downloads` (é o transporte que o app
 *   já usa para falar com o `accounts.`), global no `mesas`.
 *
 * ## O que fica de fora, de propósito
 *
 * Política não sobe: guard de assunto, guard de papel, escolha de bucket,
 * validação de corpo e o vocabulário de erro continuam em cada fachada.
 * Unificá-los esconderia diferenças de domínio que precisam ficar visíveis.
 */

/** Modo de autenticação da chamada ao `accounts.`. */
export type FacadeRelayMode = 'service' | 'session';

export const FACADE_RELAY_TIMEOUT_MS = 5_000;

/** Resposta mínima que o relay consome — o que `fetch` devolve. */
export interface FacadeRelayResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
}

/** `fetch` do app: global no `mesas`, `undici` explícito no `downloads`. */
export type FacadeRelayFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<FacadeRelayResponse>;

export const isBodyless = (method: string): boolean =>
  ['GET', 'HEAD'].includes(method.toUpperCase());

/**
 * Valida header de texto vindo do cliente que será repassado ao `accounts.`.
 *
 * Nasceu para `X-Correlation-Id` (`contrato-http-v1.md` §1.1: opcional, ASCII
 * ≤128, ecoado em toda resposta de erro) e hoje guarda também
 * `Idempotency-Key`, que tem o mesmo formato e o mesmo risco — as duas são
 * texto do cliente virando header de saída. Nulo quando ausente ou fora do
 * formato, nunca um valor inventado: id gerado aqui não existiria em log nenhum
 * do cliente, e chave de idempotência inventada quebraria a retentativa que ela
 * existe para cobrir.
 */
export function readClientHeader(header: string | undefined): string | null {
  if (typeof header !== 'string' || header.length === 0 || header.length > 128) return null;
  // ASCII imprimível: header com caractere de controle indo para log e response
  // é o risco clássico de response splitting.
  return /^[\x20-\x7E]+$/.test(header) ? header : null;
}

/** O que o adaptador extrai da requisição do framework. */
export interface FacadeRelayRequest {
  method: string;
  /** Headers já lidos: `authorization`, `cookie`, `x-correlation-id`, `idempotency-key`. */
  header: (name: string) => string | undefined;
  /** Corpo já montado pela fachada. */
  body?: unknown;
}

/**
 * Monta os headers de saída. `realm` e `source_app` saem da credencial, nunca
 * do payload (§1.1) — aceitar do corpo seria a porta para uma credencial de
 * beta escrever em produção.
 */
export function relayHeaders(
  req: FacadeRelayRequest,
  mode: FacadeRelayMode,
  credential: string | undefined,
  actingUserId: string | undefined,
  correlation: string | null,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (mode === 'service') {
    // Não-nulo garantido pela guarda de `relayToAccounts`, que responde 503
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

export type FacadeRelayValidation = (
  body: unknown,
) => { ok: true; data: unknown } | { ok: false };

export interface FacadeRelayOptions {
  mode: FacadeRelayMode;
  origin: string | null;
  credential: string | undefined;
  /** Vocabulário de erro da fachada — cada uma tem o seu. */
  unavailableError: string;
  actingUserId?: string;
  /** `true` quando o modo `service` exige ator resolvido. */
  requireActingUser?: boolean;
  validate?: FacadeRelayValidation;
  fetchImpl: FacadeRelayFetch;
  timeoutMs?: number;
}

/**
 * O que o adaptador deve escrever na resposta do framework.
 *
 * Retorno em vez de escrita direta: é o que mantém o pacote sem `express` e o
 * que torna a decisão testável sem subir servidor.
 */
export type FacadeRelayResult =
  | { kind: 'json'; status: number; body: unknown; retryAfter?: string }
  | { kind: 'empty'; status: number; retryAfter?: string }
  | { kind: 'error'; status: number; body: unknown; logged?: { path: string; error: string } };

/**
 * Repassa ao `accounts.` e decide a resposta.
 *
 * `Retry-After` atravessa em `429` e `503`: é o único header do `accounts.` com
 * instrução operacional para o cliente. Sem ele, um `429` chega ao navegador
 * sem dizer **quando** tentar de novo, e a retentativa vira chute que
 * realimenta o próprio rate limit — pior ainda na moderação, onde o operador
 * tende a insistir.
 */
export async function relayToAccounts(
  req: FacadeRelayRequest,
  path: string,
  options: FacadeRelayOptions,
): Promise<FacadeRelayResult> {
  const correlation = readClientHeader(req.header('x-correlation-id'));

  if (!options.origin || (options.mode === 'service' && !options.credential)) {
    return {
      kind: 'error',
      status: 503,
      body: { error: options.unavailableError, correlation_id: correlation },
    };
  }

  // Falha fechada e explícita: se a ordem dos middlewares mudar num refactor, o
  // acesso não-checado viraria `TypeError` dentro de um `void` — 500 opaco em
  // vez de erro tratado (achado de review, PR #262).
  if (options.mode === 'service' && options.requireActingUser && !options.actingUserId) {
    return { kind: 'error', status: 401, body: { error: 'unauthenticated' } };
  }

  const method = req.method.toUpperCase();
  const headers = relayHeaders(
    req,
    options.mode,
    options.credential,
    options.actingUserId,
    correlation,
  );

  try {
    const response = await options.fetchImpl(`${options.origin}${path}`, {
      method,
      headers,
      body: isBodyless(method) ? undefined : JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(options.timeoutMs ?? FACADE_RELAY_TIMEOUT_MS),
    });

    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfter =
      retryAfterHeader && (response.status === 429 || response.status === 503)
        ? retryAfterHeader
        : undefined;

    const text = await response.text();
    if (!text) return { kind: 'empty', status: response.status, retryAfter };

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      // HTML de página de erro no lugar de JSON: vira `502` explícito, nunca
      // corpo repassado cru que o schema do cliente tentaria interpretar.
      return {
        kind: 'error',
        status: 502,
        body: { error: 'invalid_accounts_response', correlation_id: correlation },
      };
    }

    // A validação só se aplica à resposta de sucesso: corpo de erro do
    // `accounts.` tem shape próprio e passa adiante sem ser medido contra o
    // schema da rota — validá-lo transformaria um `429` legível num `502` opaco.
    if (options.validate && response.ok) {
      const parsed = options.validate(payload);
      if (!parsed.ok) {
        return {
          kind: 'error',
          status: 502,
          body: { error: 'invalid_accounts_response', correlation_id: correlation },
        };
      }
      return { kind: 'json', status: response.status, body: parsed.data, retryAfter };
    }

    return { kind: 'json', status: response.status, body: payload, retryAfter };
  } catch (error) {
    // O adaptador loga antes de responder: `503` é indistinguível entre
    // `accounts.` fora, timeout e DNS quebrado, e sem rastro o diagnóstico na
    // VM começa do zero.
    return {
      kind: 'error',
      status: 503,
      body: { error: options.unavailableError, correlation_id: correlation },
      logged: { path, error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Só os parâmetros nomeados atravessam. Repassar a query inteira deixaria o
 * cliente injetar filtro que o `accounts.` interpreta e a fachada não revisou.
 */
export function filteredQuery(
  query: Record<string, unknown>,
  allowed: readonly string[],
): string {
  const params = new URLSearchParams();
  for (const key of allowed) {
    const value = query[key];
    if (typeof value === 'string') params.set(key, value);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
