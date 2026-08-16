// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Spec 090, T5.5 — o sino precisa mandar `x-xsrf-token` ao marcar como lida.
 *
 * ## O bug que este teste fixa
 *
 * `csrfProtection` (`packages/auth/src/csrf.ts:30-49`) libera escrita de origem
 * **fora** da allowlist do `accounts.` apenas quando o par cookie/header
 * `xsrf_token` casa. A allowlist tem cinco origens (`app.ts:282-288`) e
 * **`downloads` não está entre elas** — então o `PUT` do sino voltava `403`
 * para todo usuário do `downloads`.
 *
 * Medido contra produção em 2026-08-15, não inferido: `PUT` com
 * `Origin: downloads.artificiorpg.com` e cookie de sessão devolveu `403`,
 * enquanto `mesas`, `glossario`, `links` e a raiz chegaram ao `401` da
 * autenticação (ou seja, passaram do CSRF).
 *
 * O sino é compartilhado e vai para módulos novos que também não estarão na
 * allowlist, por isso a correção mora aqui e não em `accounts.`, que é sagrado.
 */

const cookieStore = { value: '' };

beforeEach(() => {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieStore.value,
  });
  cookieStore.value = '';
});

afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A prova é o `PUT` que sai do componente montado — **não** o texto do fonte
 * nem um regex reescrito aqui.
 *
 * A primeira versão desta suíte fazia as duas coisas: um caso lia
 * `NotificationBell.tsx` com `readFileSync` e casava regex contra o código, e
 * os outros três reimplementavam `/(?:^|;\s*)xsrf_token=([^;]*)/` dentro do
 * próprio teste. O primeiro quebrava por formatação sem nada ter regredido; os
 * outros três provavam apenas que o regex **do arquivo de teste** funciona — se
 * a função de produção perdesse a âncora, os três continuariam verdes. Montar o
 * componente e ler o que chega no `fetch` custa poucas linhas a mais e testa o
 * que de fato importa.
 */
const ITEM = {
  id: 'receipt-1',
  event_type: 'comment_reply',
  text: 'Alguém respondeu você.',
  link: '/materiais/guia',
  source_label: 'Downloads',
  occurred_at: '2026-08-15T10:00:00.000Z',
  read_at: null,
};

function jsonOk(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

/**
 * Responde à listagem/contagem com o item não lido e ao `PUT` com `204`,
 * devolvendo o espião para inspeção da chamada de escrita.
 */
function mockFetch() {
  const spy = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    (input, init) => {
      if (init?.method === 'PUT') return Promise.resolve(new Response(null, { status: 204 }));
      const url = String(input);
      if (url.includes('unread')) return jsonOk({ count: 1 });
      return jsonOk({ items: [ITEM], cursor: null });
    },
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

/** A chamada de escrita, que é a única sob teste aqui. */
function putCall(spy: ReturnType<typeof mockFetch>) {
  return spy.mock.calls.find(([, init]) => init?.method === 'PUT');
}

/**
 * `fireEvent` e não `user-event`: este pacote não tem
 * `@testing-library/user-event` nas dependências, e o que está sob teste é o
 * header do `PUT` — não a fidelidade da simulação de ponteiro. Adicionar
 * dependência a um pacote compartilhado para isso não se justifica.
 */
async function marcarComoLida(spy: ReturnType<typeof mockFetch>) {
  const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
  const authClient = await import('@artificio/auth/client');
  const { NotificationBell } = await import('./NotificationBell.js');

  // `NotificationBell` devolve `null` sem sessão (`:266`) — sem este duplo não
  // existe sino para clicar, e o teste falharia por ausência de usuário, não
  // por defeito no header.
  vi.spyOn(authClient, 'useSession').mockReturnValue({
    user: { id: 'user-1' },
    loading: false,
  } as ReturnType<typeof authClient.useSession>);

  render(<NotificationBell sourceApp="downloads" />);

  fireEvent.click(await screen.findByRole('button', { name: /notifica/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar como lida' }));

  await waitFor(() => expect(putCall(spy)).toBeDefined());
}

describe('NotificationBell — anti-CSRF na escrita', () => {
  it('manda o valor do cookie no header e mantém a sessão same-origin', async () => {
    cookieStore.value = 'artificio_session=abc; xsrf_token=token-esperado; outro=1';
    const spy = mockFetch();

    await marcarComoLida(spy);

    const call = putCall(spy);
    expect(call).toBeDefined();
    const headers = call![1]?.headers as Record<string, string>;
    expect(headers['x-xsrf-token']).toBe('token-esperado');
    // Sem `credentials: 'include'` o cookie de sessão não viaja, e o `PUT`
    // morreria no `401` antes mesmo de o CSRF ser avaliado.
    expect(call![1]?.credentials).toBe('include');
  });

  it('decodifica o valor percent-encoded do cookie', async () => {
    // O cookie é gravado com `encodeURIComponent`; mandar o valor cru faria o
    // par cookie/header divergir e o servidor recusaria com `403`.
    cookieStore.value = 'xsrf_token=a%2Bb%2Fc';
    const spy = mockFetch();

    await marcarComoLida(spy);

    expect((putCall(spy)![1]?.headers as Record<string, string>)['x-xsrf-token']).toBe('a+b/c');
  });

  it('não inventa header quando o cookie não existe', async () => {
    cookieStore.value = 'artificio_session=abc';
    const spy = mockFetch();

    await marcarComoLida(spy);

    // Sem cookie, o `PUT` sai sem header — e o servidor recusa, que é o
    // comportamento correto: forjar um valor aqui não passaria no double-submit
    // e ainda mascararia o motivo real da recusa.
    expect(putCall(spy)![1]?.headers).not.toHaveProperty('x-xsrf-token');
  });

  it('não casa com cookie de nome parecido', async () => {
    // A âncora `(?:^|;\s*)` da função de produção existe para isto: sem ela,
    // `nao_xsrf_token` casaria e o header sairia com o valor errado — recusa
    // silenciosa no servidor, indistinguível de sessão expirada.
    cookieStore.value = 'nao_xsrf_token=intruso';
    const spy = mockFetch();

    await marcarComoLida(spy);

    expect(putCall(spy)![1]?.headers).not.toHaveProperty('x-xsrf-token');
  });
});
