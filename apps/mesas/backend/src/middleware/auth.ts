import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { requireAuth as sharedRequireAuth, verifyToken } from '@artificio/auth';
import type { AuthenticatedRequest } from '@artificio/auth';
import type { UserRole } from '../db/types.js';
import type { Session } from '@artificio/auth';
import { db } from '../db/index.js';

export interface AuthDecoded {
  userId: string;
  role: UserRole;
  // Opcional só para requests sintéticos/legados; middleware SSO sempre popula.
  // Qualquer capacidade global deve exigir igualdade explícita, nunca fallback.
  globalRole?: Session['user']['role'];
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

const toMesasRole = (role: Session['user']['role']): UserRole => role === 'admin' ? 'admin' : 'player';

/**
 * Papel efetivo do mesas: `admin` vem **só** do `accounts.`; o papel local
 * contribui apenas com capacidade de domínio (`gm`, `player`, `visitor`).
 *
 * Sem o descarte do `admin` local, rebaixar alguém no `accounts.` não tirava o
 * acesso aqui: `mesas.users.role` ainda podia valer `'admin'` de antes do SSO, e
 * todo `requireRole('admin')` seguia liberando a conta (achado de review,
 * PR #233). A spec 090 torna o `accounts.` a origem do papel global — papel
 * global local é resíduo, não autoridade, e por isso não é fallback.
 */
export function resolveEffectiveMesasRole(
  globalRole: Session['user']['role'],
  localRole: UserRole,
): UserRole {
  if (globalRole === 'admin') return 'admin';
  return localRole === 'admin' ? 'player' : localRole;
}

// Usuário local do mesas provisionado via SSO (accounts.) na primeira vez que
// aparece — sem isto, req.user.userId caía no fallback session.user.id (UUID
// do accounts, não existente em mesas.users), quebrando com FK violation
// 23503 em toda rota que grava user_id (achado real, 2026-07-12: contas
// wildbladewhd@gmail.com e marcio.grove@gmail.com nunca logaram no mesas
// antes, POST /gm/profile morria com "not present in table users").
const isUniqueViolation = (error: unknown): boolean =>
  error !== null && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505';

/**
 * Reconcilia `users.google_id` com o `users.id` do `accounts.` no login.
 *
 * A coluna tem nome legado: até o SSO, guardava o `google_sub` (21 dígitos);
 * desde então o `INSERT` abaixo grava `session.user.id`, que é o UUID do
 * registro central. Quem já existia antes ficou com o valor antigo e **nunca
 * era regravado** — o `SELECT` casa essas contas pelo `email` e devolvia a linha
 * como está (achado de review, PR #273).
 *
 * O efeito não era o login: era o guard de comentários. `tableSubjectGuard`
 * manda esta coluna como `ownerUserId`, o contrato compartilhado exige UUID
 * (`subjectAuthorization.ts:135`) e o valor legado degradava para `null` — o
 * mestre deixava de ser notificado do próprio anúncio, em silêncio. Medido em
 * produção (2026-08-18): 15 dos 68 usuários com valor legado, **14 mesas**
 * afetadas, e os 15 com e-mail preenchido (portanto logando normalmente e
 * nunca reconciliando).
 *
 * Colisão `23505` é engolida de propósito: significa que OUTRA linha já detém
 * este `google_id` (conta duplicada da migração). Derrubar o login por isso
 * puniria o usuário por um resíduo de dado; a mesa segue sem dono resolvido,
 * que é exatamente o estado anterior, e o caso vira dado para limpeza manual —
 * não há nenhuma duplicata de e-mail em produção hoje (medido: 0).
 */
const reconcileLegacyGoogleId = async (
  userId: string,
  currentGoogleId: string,
  accountsUserId: string,
): Promise<void> => {
  if (currentGoogleId === accountsUserId) return;

  try {
    await db
      .updateTable('users')
      .set({ google_id: accountsUserId })
      .where('id', '=', userId)
      .where('google_id', '=', currentGoogleId)
      .execute();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
};

const resolveMesasUser = async (session: Session) => {
  const existing = await db
    .selectFrom('users')
    .select(['id', 'email', 'role', 'google_id'])
    .where((eb) => eb.or([
      eb('google_id', '=', session.user.id),
      eb('email', '=', session.user.email),
    ]))
    .executeTakeFirst();
  if (existing) {
    await reconcileLegacyGoogleId(existing.id, existing.google_id, session.user.id);
    return existing;
  }

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
  const raced = await db
    .selectFrom('users')
    .select(['id', 'email', 'role', 'google_id'])
    .where((eb) => eb.or([
      eb('google_id', '=', session.user.id),
      eb('email', '=', session.user.email),
    ]))
    .executeTakeFirst();
  // Mesma reconciliação do caminho comum: a linha achada aqui pode ser a conta
  // legada casada por e-mail, não a que o request concorrente acabou de criar.
  if (raced) await reconcileLegacyGoogleId(raced.id, raced.google_id, session.user.id);
  return raced;
};

const attachLegacyUser = async (req: Request): Promise<boolean> => {
  const session = (req as unknown as AuthenticatedRequest).session;
  if (!session) return false;
  const mesasUser = await resolveMesasUser(session);
  if (!mesasUser) return false;

  req.user = {
    userId: mesasUser.id,
    role: resolveEffectiveMesasRole(session.user.role, mesasUser.role),
    globalRole: session.user.role,
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
