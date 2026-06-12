import { Response, NextFunction } from 'express';
import { verifyToken } from '@artificio/auth';
import { resolveLocalUser } from '../auth/resolveLocalUser';
import { fetchUserRoleFromDb, normalizeRole } from '../utils/userRole';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Tokens candidatos: cookie `artificio_session` (SSO accounts.) e header
 * `Authorization: Bearer` (compat). Mesmo JWT_SECRET do accounts (D018);
 * `@artificio/auth` valida HS256. Retorna a sessão do 1º token válido — um
 * Bearer inválido/legado (`Bearer null`) não bloqueia o cookie válido.
 */
function resolveSession(req: any) {
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
 * LOCAL do glossário (account-linking por email — spec 015). `packages/auth`
 * intocado (auth sagrado).
 */
export const authMiddleware = (req: any, res: Response, next: NextFunction) => {
  const session = resolveSession(req);
  if (!session) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }

  resolveLocalUser(session)
    .then((local) => {
      // admin GLOBAL do SSO (token.role === 'admin') = superusuário (D052/req.5).
      const isGlobalAdmin = session.user.role === 'admin';
      req.user = {
        id: local.id,
        role: isGlobalAdmin ? 'admin' : local.role,
        role_source: 'sso',
        is_global_admin: isGlobalAdmin,
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
 * Restringe acesso a administradores. Usar APÓS o authMiddleware.
 * Admin global do SSO passa direto; admin LOCAL é revalidado no banco.
 */
export const adminMiddleware = (req: any, res: Response, next: NextFunction) => {
  if (req?.user?.is_global_admin === true) {
    return next();
  }

  const currentRole = normalizeRole(req?.user?.role);
  const roleSource = req?.user?.role_source;

  // role já revalidada no banco (refreshUserRole) e é admin → ok.
  if (currentRole === 'admin' && roleSource === 'db') {
    return next();
  }

  const userId = req?.user?.id;
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  fetchUserRoleFromDb(userId)
    .then((roleFromDb) => {
      if (!roleFromDb) {
        return res.status(401).json({ message: 'Usuário não encontrado.' });
      }

      req.user = {
        ...req.user,
        role: roleFromDb,
        role_source: 'db',
      };

      if (roleFromDb !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a administradores.' });
      }

      return next();
    })
    .catch((err) => {
      console.error('[adminMiddleware] Erro ao revalidar role no banco:', err);
      return res
        .status(503)
        .json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
    });
};
