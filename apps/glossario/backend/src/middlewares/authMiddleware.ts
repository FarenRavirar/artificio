import { Response, NextFunction } from 'express';
import { verifyToken } from '@artificio/auth';
import { resolveLocalUser } from '../auth/resolveLocalUser.js';
import type { AuthedRequest } from '../types/express.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Tokens candidatos: cookie `artificio_session` (SSO accounts.) e header
 * `Authorization: Bearer` (compat). Mesmo JWT_SECRET do accounts (D018);
 * `@artificio/auth` valida HS256. Retorna a sessão do 1º token válido — um
 * Bearer inválido/legado (`Bearer null`) não bloqueia o cookie válido.
 */
function resolveSession(req: AuthedRequest) {
  const candidates: string[] = [];
  const header = req.headers?.['authorization'];
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const t = header.slice(7).trim();
    if (t) candidates.push(t);
  }
  const cookie = req.cookies?.artificio_session;
  if (typeof cookie === 'string' && cookie) candidates.push(cookie);

  for (const token of candidates) {
    const session = verifyToken(token);
    if (session) return session;
  }
  return null;
}

/**
 * Middleware de sessão via SSO. Valida o JWT do accounts e resolve o usuário
 * LOCAL do glossário (account-linking por email — spec 015). O vínculo local
 * preserva identidade/ownership, nunca autoridade global.
 */
export const authMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const session = resolveSession(req);
  if (!session) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }

  resolveLocalUser(session)
    .then((local) => {
      // admin GLOBAL do SSO = superusuário (D052/req.5); moderator GLOBAL mantém
      // só autoridade de moderação e não vira admin local do glossário.
      const isGlobalAdmin = session.user.role === 'admin';
      const isGlobalModerator = session.user.role === 'moderator';
      req.user = {
        id: local.id,
        role: isGlobalAdmin ? 'admin' : 'member',
        role_source: 'sso',
        is_global_admin: isGlobalAdmin,
        is_global_moderator: isGlobalModerator,
        email: local.email,
        name: session.user.name,
        // sub/email do SSO (accounts) — consumidos pelo fluxo de reivindicação (claim).
        sub: session.user.id,
        sso_email: session.user.email,
      };
      return next();
    })
    .catch((err) => {
      console.error('[authMiddleware] Falha ao resolver usuário local:', err);
      return res
        .status(503)
        .json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
    });
};

/**
 * Sessão OPCIONAL: usado por endpoints públicos (ex.: feedback anônimo, Spec 021).
 * Se houver token válido, popula `req.user` (best-effort) para enriquecer o registro;
 * sem token, segue como visitante (não bloqueia). Falha ao resolver usuário local
 * NÃO derruba a requisição — apenas segue anônimo.
 */
export const optionalAuthMiddleware = (req: AuthedRequest, _res: Response, next: NextFunction) => {
  const session = resolveSession(req);
  if (!session) return next();

  resolveLocalUser(session)
    .then((local) => {
      const isGlobalAdmin = session.user.role === 'admin';
      const isGlobalModerator = session.user.role === 'moderator';
      req.user = {
        id: local.id,
        role: isGlobalAdmin ? 'admin' : 'member',
        role_source: 'sso',
        is_global_admin: isGlobalAdmin,
        is_global_moderator: isGlobalModerator,
        email: local.email,
        name: session.user.name,
        sub: session.user.id,
        sso_email: session.user.email,
      };
      return next();
    })
    .catch((err) => {
      console.warn('[optionalAuthMiddleware] Sessão presente mas falhou ao resolver; seguindo anônimo:', err?.message || err);
      return next();
    });
};

/**
 * Restringe acesso a administradores. Usar APÓS o authMiddleware.
 * Só admin global do SSO passa; papel local nunca é fallback.
 */
export const adminMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (req?.user?.is_global_admin === true) {
    return next();
  }

  if (!req.user?.id) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  return res.status(403).json({ message: 'Acesso restrito a administradores.' });
};
