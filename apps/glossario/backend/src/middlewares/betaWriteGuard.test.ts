import type { NextFunction, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthedRequest } from '../types/express.js';
import { betaModerationGuard, betaWriteGuard } from './betaWriteGuard.js';

// `refreshUserRole` colapsa o papel do SSO em 'member' quando não é
// `is_global_admin`, então moderador global chega aqui indistinguível de membro
// comum e levava 403 antes de `deleteComment` — que reconhece
// `is_global_moderator`. Moderação ficava inoperante em beta (achado de review,
// PR #233).
//
// A isenção vive em `betaModerationGuard`, não no `betaWriteGuard`: este é
// compartilhado por social, term, system, scenario, category, user e import, e
// isentar ali liberaria moderador global para votar, comentar, editar perfil,
// sugerir e importar em beta — muito além de moderar (2ª passada do review).
type Guard = (req: AuthedRequest, res: Response, next: NextFunction) => unknown;

function runGuard(guard: Guard, user: Partial<NonNullable<AuthedRequest['user']>> | undefined) {
  const req = { user } as AuthedRequest;
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response;
  const next = vi.fn();
  guard(req, res, next);
  return { json, res, next };
}

const originalAppEnv = process.env.APP_ENV;
const originalReadonly = process.env.BETA_READONLY_MEMBERS;

function enableBetaReadonly() {
  process.env.APP_ENV = 'beta';
  process.env.BETA_READONLY_MEMBERS = 'true';
}

afterEach(() => {
  process.env.APP_ENV = originalAppEnv;
  process.env.BETA_READONLY_MEMBERS = originalReadonly;
});

describe('betaWriteGuard (contribuição) em beta somente-leitura', () => {
  it('bloqueia membro comum', () => {
    enableBetaReadonly();
    const { res, next } = runGuard(betaWriteGuard, { role: 'member', is_global_moderator: false });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('bloqueia moderador global — contribuir não é moderar', () => {
    enableBetaReadonly();
    const { res, next } = runGuard(betaWriteGuard, { role: 'member', is_global_moderator: true });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('libera admin', () => {
    enableBetaReadonly();
    const { res, next } = runGuard(betaWriteGuard, { role: 'admin', is_global_moderator: false });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('não bloqueia fora do beta', () => {
    process.env.APP_ENV = 'prod';
    process.env.BETA_READONLY_MEMBERS = 'true';
    const { res, next } = runGuard(betaWriteGuard, { role: 'member', is_global_moderator: false });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('betaModerationGuard (moderação) em beta somente-leitura', () => {
  it('libera moderador global mesmo com papel local member', () => {
    enableBetaReadonly();
    const { res, next } = runGuard(betaModerationGuard, { role: 'member', is_global_moderator: true });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('continua bloqueando membro sem papel global', () => {
    enableBetaReadonly();
    const { res, next } = runGuard(betaModerationGuard, { role: 'member', is_global_moderator: false });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('libera admin', () => {
    enableBetaReadonly();
    const { res, next } = runGuard(betaModerationGuard, { role: 'admin', is_global_moderator: false });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
