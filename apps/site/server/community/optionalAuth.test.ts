import express from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({ verifyToken: vi.fn() }));
vi.mock('@artificio/auth', () => authMocks);

import { optionalAuth } from './optionalAuth';

const SESSAO = {
  user: { id: 'user-1', email: 'u@example.com', name: 'Usuária', role: 'user' },
  exp: 0,
};

/**
 * Sobe a rota atrás do middleware e devolve o que ele resolveu como sessão.
 * O que interessa é o efeito observável: quem o request diz ser depois de
 * passar por ali.
 */
/**
 * Limiter no servidor efêmero, espelhando a fachada real.
 *
 * Em produção `optionalAuth` **só** existe atrás de `readRateLimiter`
 * (`community-api.ts:268`) — o CodeQL sinalizou este arquivo porque via um
 * handler de autorização sem limite, sem saber que era um duplo de teste.
 * Montá-lo aqui também custa nada e mantém o teste fiel à composição real: se
 * alguém remover o limiter da fachada, este arquivo continua descrevendo o que
 * a rota de verdade faz.
 */
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });

async function chamar(headers: Record<string, string> = {}) {
  const app = express();
  app.use(cookieParser());
  app.use(limiter);
  app.use(optionalAuth);
  app.get('/', (req, res) => {
    const session = (req as { session?: { user?: { id?: string } } }).session;
    res.json({ userId: session?.user?.id ?? null });
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test_server_address_missing');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/`, { headers });
    return { status: response.status, body: await response.json() as { userId: string | null } };
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('sessão opcional na leitura da conversa', () => {
  it('segue sem sessão quando não há token, sem responder erro', async () => {
    const { status, body } = await chamar();

    // A leitura da árvore é PÚBLICA: exigir login aqui (como `requireAuth`
    // faria) fecharia a conversa para quem só quer ler.
    expect(status).toBe(200);
    expect(body.userId).toBeNull();
    expect(authMocks.verifyToken).not.toHaveBeenCalled();
  });

  it('resolve a sessão pelo cookie e expõe o usuário', async () => {
    authMocks.verifyToken.mockReturnValue(SESSAO);

    const { body } = await chamar({ cookie: 'artificio_session=token-valido' });

    // Sem isto, `my_vote` e `viewer_is_author` sumiriam para quem ESTÁ logado —
    // a pessoa veria o próprio voto desaparecer da tela.
    expect(body.userId).toBe('user-1');
    expect(authMocks.verifyToken).toHaveBeenCalledWith('token-valido');
  });

  it('aceita Bearer e dá precedência a ele sobre o cookie', async () => {
    authMocks.verifyToken.mockReturnValue(SESSAO);

    await chamar({
      authorization: 'Bearer token-do-header',
      cookie: 'artificio_session=token-do-cookie',
    });

    expect(authMocks.verifyToken).toHaveBeenCalledWith('token-do-header');
  });

  it('ignora esquema que não seja Bearer e cai no cookie', async () => {
    authMocks.verifyToken.mockReturnValue(SESSAO);

    await chamar({
      authorization: 'Basic dXNlcjpwYXNz',
      cookie: 'artificio_session=token-do-cookie',
    });

    // `Basic` não é sessão do SSO. Tratá-lo como token mandaria a senha
    // codificada para `verifyToken` e registraria credencial em log de erro.
    expect(authMocks.verifyToken).toHaveBeenCalledWith('token-do-cookie');
  });

  it('segue sem sessão quando o token é inválido ou expirado', async () => {
    authMocks.verifyToken.mockReturnValue(null);

    const { status, body } = await chamar({ cookie: 'artificio_session=token-velho' });

    // Cookie velho é o caso comum — todo navegador acaba tendo um. Responder
    // erro transformaria isso em página de comentários quebrada, quando o
    // correto é mostrar a conversa deslogada.
    expect(status).toBe(200);
    expect(body.userId).toBeNull();
  });

  it('não deixa cookie de outro nome virar sessão', async () => {
    authMocks.verifyToken.mockReturnValue(SESSAO);

    const { body } = await chamar({ cookie: 'outra_coisa=token-valido' });

    expect(body.userId).toBeNull();
    expect(authMocks.verifyToken).not.toHaveBeenCalled();
  });
});
