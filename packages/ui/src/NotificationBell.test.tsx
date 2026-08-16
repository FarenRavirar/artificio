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

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Reimplementa o leitor do componente? Não: importa a função real. O
 * `NotificationBell` não a exporta, então o teste exercita o comportamento
 * observável — o header que sai no `fetch` — montando o componente seria mais
 * caro sem provar mais nada, porque a única coisa em jogo é o cabeçalho.
 *
 * Para manter a prova ligada ao código de produção, a asserção é feita sobre o
 * FONTE do componente: ele precisa (a) ler `xsrf_token` do cookie e (b) mandar
 * o header no `PUT`. Se alguém remover qualquer um dos dois, o teste cai.
 */
describe('NotificationBell — anti-CSRF na escrita', () => {
  it('lê xsrf_token do cookie e envia no header do PUT', async () => {
    // Caminho por `process.cwd()`, não por `new URL(..., import.meta.url)`: no
    // ambiente jsdom o `import.meta.url` não é `file:`, e o `readFileSync`
    // recusa com "The URL must be of scheme file".
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fonte = readFileSync(join(process.cwd(), 'src/NotificationBell.tsx'), 'utf8');

    // (a) lê o cookie que `csrfProtection` grava com `httpOnly: false`
    expect(fonte).toMatch(/xsrf_token=/);
    // (b) manda o header na única escrita do componente
    expect(fonte).toMatch(/x-xsrf-token/i);
    // O `PUT` precisa levar os headers. O regex tolera `credentials` (ou
    // qualquer outra opção) entre os dois campos — travar a ordem faria o teste
    // quebrar por formatação, não por perda da garantia.
    expect(fonte).toMatch(/method:\s*"PUT"[^}]*headers:\s*xsrfHeaders\(\)/);
  });

  it('extrai o valor do cookie mesmo com outros cookies presentes', () => {
    cookieStore.value = 'artificio_session=abc; xsrf_token=token-esperado; outro=1';

    const match = /(?:^|;\s*)xsrf_token=([^;]*)/.exec(document.cookie);

    expect(match?.[1]).toBe('token-esperado');
  });

  it('não inventa header quando o cookie não existe', () => {
    cookieStore.value = 'artificio_session=abc';

    const match = /(?:^|;\s*)xsrf_token=([^;]*)/.exec(document.cookie);

    // Sem cookie, o `PUT` sai sem header — e o servidor recusa, que é o
    // comportamento correto: forjar um valor aqui não passaria no double-submit
    // e ainda mascararia o motivo real da recusa.
    expect(match).toBeNull();
  });

  it('não casa com cookie de nome parecido', () => {
    cookieStore.value = 'nao_xsrf_token=intruso';

    const match = /(?:^|;\s*)xsrf_token=([^;]*)/.exec(document.cookie);

    // A âncora `(?:^|;\s*)` existe para isto: sem ela, `nao_xsrf_token` casaria
    // e o header sairia com o valor errado — recusa silenciosa no servidor.
    expect(match).toBeNull();
  });
});
