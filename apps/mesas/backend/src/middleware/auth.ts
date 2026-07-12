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

// Usuário local do mesas provisionado via SSO (accounts.) na primeira vez que
// aparece — sem isto, req.user.userId caía no fallback session.user.id (UUID
// do accounts, não existente em mesas.users), quebrando com FK violation
// 23503 em toda rota que grava user_id (achado real, 2026-07-12: contas
// wildbladewhd@gmail.com e marcio.grove@gmail.com nunca logaram no mesas
// antes, POST /gm/profile morria com "not present in table users").
const isUniqueViolation = (error: unknown): boolean =>
  error !== null && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505';

const resolveMesasUser = async (session: Session) => {
  const existing = await db
    .selectFrom('users')
    .select(['id', 'email', 'role'])
    .where((eb) => eb.or([
      eb('google_id', '=', session.user.id),
      eb('email', '=', session.user.email),
    ]))
    .executeTakeFirst();
  if (existing) return existing;

  try {
    const [created] = await db
      .insertInto('users')
      .values({
        google_id: session.user.id,
        email: session.user.email,
        role: toMesasRole(session.user.role),
      })
      .onConflict((oc) => oc.column('email').doNothing())
      .returning(['id', 'email', 'role'])
      .execute();
    if (created) return created;
  } catch (error) {
    // Só recupera de corrida real (23505 — outro request provisionou entre o
    // SELECT e o INSERT via google_id, não coberto pelo onConflict de email).
    // Qualquer outro erro (DB fora do ar, timeout etc.) deve propagar, não
    // virar 401 silencioso.
    if (!isUniqueViolation(error)) throw error;
  }

  // corrida: outro request provisionou primeiro entre o SELECT e o INSERT
  // (email ou google_id, ambos únicos) — relê pelos mesmos critérios do SELECT inicial.
  return await db
    .selectFrom('users')
    .select(['id', 'email', 'role'])
    .where((eb) => eb.or([
      eb('google_id', '=', session.user.id),
      eb('email', '=', session.user.email),
    ]))
    .executeTakeFirst();
};

const attachLegacyUser = async (req: Request): Promise<boolean> => {
  const session = (req as unknown as AuthenticatedRequest).session;
  if (!session) return false;
  const mesasUser = await resolveMesasUser(session);
  if (!mesasUser) return false;

  req.user = {
    userId: mesasUser.id,
    role: session.user.role === 'admin' ? 'admin' : mesasUser.role,
    email: mesasUser.email,
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
