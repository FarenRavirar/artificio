import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthedRequest } from '../types/express.js';
import { betaWriteGuard } from './betaWriteGuard.js';

// `refreshUserRole` colapsa o papel do SSO em 'member' quando não é
// `is_global_admin`, então moderador global chegava aqui indistinguível de
// membro comum e levava 403 antes de `deleteComment` — que reconhece
// `is_global_moderator`. Moderação ficava inoperante em beta (achado de review,
// PR #233). O guard barra *contribuição* de membro, não ação de moderação.
function runGuard(user: Partial<NonNullable<AuthedRequest['user']>> | undefined) {
  const req = { user } as AuthedRequest;
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response;
  const next = vi.fn();
  betaWriteGuard(req, res, next);
  return { json, res, next };
}

describe('betaWriteGuard em beta somente-leitura', () => {
  const originalAppEnv = process.env.APP_ENV;
  const originalReadonly = process.env.BETA_READONLY_MEMBERS;

  afterEach(() => {
    process.env.APP_ENV = originalAppEnv;
    process.env.BETA_READONLY_MEMBERS = originalReadonly;
  });

  function enableBetaReadonly() {
    process.env.APP_ENV = 'beta';
    process.env.BETA_READONLY_MEMBERS = 'true';
  }

  it('bloqueia membro comum', () => {
    enableBetaReadonly();
    const { res, next } = runGuard({ role: 'member', is_global_moderator: false });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('libera moderador global mesmo com papel local member', () => {
    enableBetaReadonly();
    const { res, next } = runGuard({ role: 'member', is_global_moderator: true });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('libera admin', () => {
    enableBetaReadonly();
    const { res, next } = runGuard({ role: 'admin', is_global_moderator: false });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('não bloqueia fora do beta', () => {
    process.env.APP_ENV = 'prod';
    process.env.BETA_READONLY_MEMBERS = 'true';
    const { res, next } = runGuard({ role: 'member', is_global_moderator: false });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
