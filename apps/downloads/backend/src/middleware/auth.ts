import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { requireAuth as sharedRequireAuth, verifyToken } from '@artificio/auth';
import type { AuthenticatedRequest } from '@artificio/auth';
import type { DownloadCreatorRole } from '../db/types';
import { db } from '../db';

export interface AuthDecoded {
  userId: string;
  role: DownloadCreatorRole;
  email?: string;
  name?: string;
  avatar?: string | null;
  exp?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- mesmo padrao de apps/mesas/backend/src/middleware/auth.ts (unica forma de estender Request via @types/express).
  namespace Express {
    interface Request {
      user?: AuthDecoded;
    }
  }
}

// Downloads nao tem tabela users propria (SSO direto via accounts.); role
// vem de download_creator quando existe perfil de criador, senao 'user'.
const resolveCreatorRole = async (userId: string): Promise<DownloadCreatorRole> => {
  try {
    const creator = await db
      .selectFrom('download_creator')
      .select('role')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return creator?.role ?? 'user';
  } catch {
    return 'user';
  }
};

const attachUser = async (req: Request): Promise<boolean> => {
  const session = (req as unknown as AuthenticatedRequest).session;
  if (!session) return false;

  const role = session.user.role === 'admin' ? 'admin' : await resolveCreatorRole(session.user.id);

  req.user = {
    userId: session.user.id,
    role,
    email: session.user.email,
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

    void attachUser(req)
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

export const requireRole = (roles: DownloadCreatorRole | DownloadCreatorRole[]) => {
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

export const requireAdmin = [authMiddleware, requireRole('admin')];

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
  void attachUser(req).then(() => next()).catch(next);
};
