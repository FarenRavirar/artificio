import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { requireAuth as sharedRequireAuth, verifyToken } from '@artificio/auth';
import type { AuthenticatedRequest } from '@artificio/auth';
import type { UserRole } from '../db/types';
import type { Session } from '@artificio/auth';
import { db } from '../db';

export interface AuthDecoded {
  userId: string;
  role: UserRole;
  email?: string;
  name?: string;
  avatar?: string | null;
  exp?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- augmentação do namespace global Express é o padrão oficial do tipo (@types/express) para estender Request; não há alternativa ES2015 module aqui.
  namespace Express {
    interface Request {
      user?: AuthDecoded;
    }
  }
}

const toMesasRole = (role: 'user' | 'admin'): UserRole => role === 'admin' ? 'admin' : 'player';

const resolveMesasUser = async (session: Session) => {
  try {
    return await db
      .selectFrom('users')
      .select(['id', 'email', 'role'])
      .where((eb) => eb.or([
        eb('google_id', '=', session.user.id),
        eb('email', '=', session.user.email),
      ]))
      .executeTakeFirst();
  } catch {
    return undefined;
  }
};

const attachLegacyUser = async (req: Request): Promise<boolean> => {
  const session = (req as unknown as AuthenticatedRequest).session;
  if (!session) return false;
  const mesasUser = await resolveMesasUser(session);

  req.user = {
    userId: mesasUser?.id ?? session.user.id,
    role: session.user.role === 'admin' ? 'admin' : mesasUser?.role ?? toMesasRole(session.user.role),
    email: mesasUser?.email ?? session.user.email,
    name: session.user.name,
    avatar: session.user.avatar,
    exp: session.exp,
  };

  return true;
};

const runSharedRequireAuth = sharedRequireAuth as unknown as RequestHandler;

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  runSharedRequireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }

    void attachLegacyUser(req)
      .then((attached) => {
        if (!attached) {
          res.status(401).json({ error: 'Token inválido ou expirado.' });
          return;
        }

        next();
      })
      .catch(next);
  });
};

export const requireRole = (roles: UserRole | UserRole[]) => {
  const rolesArr = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (!rolesArr.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para o seu perfil.' });
    }

    next();
  };
};

export const requireAdmin = [
  authMiddleware,
  requireRole('admin')
];

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = typeof req.cookies?.artificio_session === 'string' ? req.cookies.artificio_session : null;
  const session = verifyToken(bearerToken ?? cookieToken ?? '');

  if (!session) {
    req.user = undefined;
    next();
    return;
  }

  (req as unknown as AuthenticatedRequest).session = session;
  void attachLegacyUser(req).then(() => next()).catch(next);
};
