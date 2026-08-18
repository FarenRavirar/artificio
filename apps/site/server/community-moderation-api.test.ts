import express from 'express';
import cookieParser from 'cookie-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fachada de moderação do `site` (achado de review, PR #274).
 *
 * O que estes testes protegem é o defeito que o achado descreve: a política
 * compartilhada passou a oferecer os botões de moderação ao admin, e no blog
 * eles caíam em `404` — o `site` montava apenas `/community/conversation`.
 */

/** Papel devolvido pelo duplo de `requireAuth`, trocado por teste. */
let papelDaSessao: 'user' | 'moderator' | 'admin' | null = 'admin';

/**
 * Mesmo desenho do duplo em `community-api.test.ts`: contrato de `requireAuth`
 * (`401` sem sessão, `req.session` preenchida com ela) sem assinar JWT real —
 * `jsonwebtoken` é transitivo do `site`, e acrescentar dependência para
 * viabilizar teste é decisão do mantenedor.
 *
 * A diferença é `papelDaSessao`: o guard sob teste decide por papel, então
 * fixá-lo como `'user'` mediria só o caminho de recusa.
 */
vi.mock('@artificio/auth', async (original) => ({
  ...(await original<typeof import('@artificio/auth')>()),
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (papelDaSessao === null) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as { session?: unknown }).session = {
      user: { id: 'user-1', email: 'u@example.com', name: 'Usuária', role: papelDaSessao },
      exp: Math.floor(Date.now() / 1000) + 300,
    };
    next();
  },
}));

import { communityModerationApi } from './community-moderation-api';

const servers: Array<ReturnType<ReturnType<typeof express>['listen']>> = [];

async function call(path: string, init?: RequestInit) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(communityModerationApi());
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test_server_address_missing');
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'spam reincidente' }),
    ...init,
  });
}

/** Ver `community-api.test.ts`: host por `hostname`, nunca `startsWith`. */
function ehAccounts(url: unknown): boolean {
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === 'https:' && parsed.hostname === 'accounts.example';
  } catch {
    return false;
  }
}

function interceptaAccounts(resposta: Response) {
  const real = globalThis.fetch;
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (ehAccounts(input)) return Promise.resolve(resposta);
    return real(input as RequestInfo, init);
  });
}

const COMENTARIO = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  papelDaSessao = 'admin';
  vi.stubEnv('ACCOUNTS_URL', 'https://accounts.example');
  vi.stubEnv('SERVICE_CREDENTIAL', 'credencial-de-servico');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))));
});

describe('fachada de moderação do site', () => {
  it('roteia a retirada para o accounts. em vez de devolver 404', async () => {
    // O defeito relatado: sem este router montado, o admin clicava em "Retirar
    // (moderação)" no blog e recebia `404` — a política oferecia a capacidade,
    // e o `site` não tinha a rota.
    const espiao = interceptaAccounts(new Response(null, { status: 204 }));

    const resposta = await call(`/comments/${COMENTARIO}/removal`);

    expect(resposta.status).toBe(204);
    const [url, init] = espiao.mock.calls.find(([entrada]) => ehAccounts(entrada))!;
    expect(String(url)).toBe(`https://accounts.example/internal/v1/comments/${COMENTARIO}/removal`);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ reason: 'spam reincidente' });
    // Moderação é sempre ação de alguém identificado: o `accounts.` resolve o
    // ator moderador por este header e o grava na auditoria.
    expect((init as RequestInit).headers).toMatchObject({ 'X-Acting-User-Id': 'user-1' });
  });

  it('roteia a restauração, que é o desfazer da retirada', async () => {
    const espiao = interceptaAccounts(new Response(null, { status: 204 }));

    const resposta = await call(`/comments/${COMENTARIO}/restore`);

    expect(resposta.status).toBe(204);
    const [url] = espiao.mock.calls.find(([entrada]) => ehAccounts(entrada))!;
    expect(String(url)).toBe(`https://accounts.example/internal/v1/comments/${COMENTARIO}/restore`);
  });

  it('aceita moderator, não só admin', async () => {
    // O papel vem do `accounts.` sem tradução: o `site` não tem papel de
    // domínio que rebaixe `moderator`, ao contrário do `mesas`.
    papelDaSessao = 'moderator';
    interceptaAccounts(new Response(null, { status: 204 }));

    expect((await call(`/comments/${COMENTARIO}/removal`)).status).toBe(204);
  });

  it('recusa usuário comum sem falar com o accounts.', async () => {
    papelDaSessao = 'user';
    const espiao = interceptaAccounts(new Response(null, { status: 204 }));

    const resposta = await call(`/comments/${COMENTARIO}/removal`);

    expect(resposta.status).toBe(403);
    // O guard barra ANTES do proxy: sem isto, a fachada gastaria a credencial
    // de serviço do módulo para receber um `403` do `accounts.`.
    expect(espiao.mock.calls.some(([entrada]) => ehAccounts(entrada))).toBe(false);
  });

  it('recusa quem não tem sessão', async () => {
    papelDaSessao = null;
    expect((await call(`/comments/${COMENTARIO}/removal`)).status).toBe(401);
  });
});
