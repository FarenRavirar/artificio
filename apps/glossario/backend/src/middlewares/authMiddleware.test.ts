import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthedRequest } from '../types/express.js';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret';

const sessionMock = vi.hoisted(() => vi.fn());
vi.mock('@artificio/auth', () => ({ verifyToken: sessionMock }));

const resolveLocalUserMock = vi.hoisted(() => vi.fn());
vi.mock('../auth/resolveLocalUser.js', () => ({ resolveLocalUser: resolveLocalUserMock }));

const { adminMiddleware, authMiddleware, optionalAuthMiddleware } = await import('./authMiddleware.js');

type Middleware = (req: AuthedRequest, res: Response, next: NextFunction) => unknown;

function run(middleware: Middleware, req: Partial<AuthedRequest>) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status } as unknown as Response;
  const next = vi.fn();
  const request = { headers: {}, cookies: {}, ...req } as AuthedRequest;
  middleware(request, res, next);
  return { json, next, request, status };
}

function session(role: 'user' | 'moderator' | 'admin') {
  return {
    user: { id: 'sso-1', email: 'pessoa@example.com', name: 'Pessoa', role },
  };
}

const LOCAL_USER = { id: 'local-1', email: 'pessoa@example.com' };

describe('authMiddleware — papel global vem só do accounts.', () => {
  beforeEach(() => {
    sessionMock.mockReset();
    resolveLocalUserMock.mockReset().mockResolvedValue(LOCAL_USER);
  });

  it('admin global vira admin local e superusuário', async () => {
    sessionMock.mockReturnValue(session('admin'));
    const { next, request } = run(authMiddleware, { cookies: { artificio_session: 'token' } });
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(request.user).toMatchObject({
      role: 'admin',
      role_source: 'sso',
      is_global_admin: true,
      is_global_moderator: false,
    });
  });

  // O `moderator` global concede só as capacidades de moderação de T0.1: não
  // vira admin local do glossário, que carrega edição de termo, categoria,
  // sistema e usuário (spec 090, T1.6).
  it('moderator global não vira admin local', async () => {
    sessionMock.mockReturnValue(session('moderator'));
    const { next, request } = run(authMiddleware, { cookies: { artificio_session: 'token' } });
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(request.user).toMatchObject({
      role: 'member',
      is_global_admin: false,
      is_global_moderator: true,
    });
  });

  it('user global fica member, sem capacidade privilegiada', async () => {
    sessionMock.mockReturnValue(session('user'));
    const { next, request } = run(authMiddleware, { cookies: { artificio_session: 'token' } });
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(request.user).toMatchObject({
      role: 'member',
      is_global_admin: false,
      is_global_moderator: false,
    });
  });

  it('sem sessão válida devolve 401 e não resolve usuário local', () => {
    sessionMock.mockReturnValue(null);
    const { next, status } = run(authMiddleware, { cookies: { artificio_session: 'invalido' } });

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(resolveLocalUserMock).not.toHaveBeenCalled();
  });

  // T1.7: falha ao provar identidade nunca promove nem segue autenticado numa
  // rota privilegiada — a requisição morre em 503, deny-by-default (OWASP).
  it('falha ao resolver usuário local recusa a requisição, não segue anônimo', async () => {
    sessionMock.mockReturnValue(session('admin'));
    resolveLocalUserMock.mockRejectedValue(new Error('accounts indisponível'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { next, request, status } = run(authMiddleware, { cookies: { artificio_session: 'token' } });
    await vi.waitFor(() => expect(status).toHaveBeenCalledWith(503));

    expect(next).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
    consoleError.mockRestore();
  });
});

describe('optionalAuthMiddleware — degradação só vale para leitura pública', () => {
  beforeEach(() => {
    sessionMock.mockReset();
    resolveLocalUserMock.mockReset().mockResolvedValue(LOCAL_USER);
  });

  // Único consumidor é o feedback anônimo (`feedbackRoutes.ts:18`), que é rota
  // pública: seguir sem `req.user` é degradação prevista em T1.7, não furo —
  // nenhuma capacidade privilegiada é concedida por esse caminho.
  it('falha ao resolver segue anônimo, sem papel algum', async () => {
    sessionMock.mockReturnValue(session('admin'));
    resolveLocalUserMock.mockRejectedValue(new Error('accounts indisponível'));
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { next, request } = run(optionalAuthMiddleware, { cookies: { artificio_session: 'token' } });
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(request.user).toBeUndefined();
    consoleWarn.mockRestore();
  });

  it('sem token segue adiante sem tocar no banco', () => {
    sessionMock.mockReturnValue(null);
    const { next } = run(optionalAuthMiddleware, {});

    expect(next).toHaveBeenCalled();
    expect(resolveLocalUserMock).not.toHaveBeenCalled();
  });
});

describe('adminMiddleware — capacidade, não nome de papel', () => {
  it('libera admin global', () => {
    const { next } = run(adminMiddleware, { user: { is_global_admin: true, id: 'local-1' } as AuthedRequest['user'] });
    expect(next).toHaveBeenCalled();
  });

  // `is_global_moderator` não abre rota administrativa: moderação de comentário
  // é a única capacidade herdada no glossário (T0.1).
  it('recusa moderator global com 403', () => {
    const { next, status } = run(adminMiddleware, {
      user: { is_global_admin: false, is_global_moderator: true, id: 'local-1' } as AuthedRequest['user'],
    });

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('recusa requisição sem usuário com 401', () => {
    const { next, status } = run(adminMiddleware, {});

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
