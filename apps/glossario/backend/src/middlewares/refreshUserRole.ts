import { Response, NextFunction } from 'express';
import { fetchUserRoleFromDb } from '../utils/userRole';
import type { AuthedRequest } from '../types/express';

/**
 * Revalida a role no banco em cada requisição autenticada sensível.
 * Mitiga token JWT com claim de role desatualizado.
 */
export const refreshUserRole = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const currentUser = req.user;
  const userId = currentUser?.id;

  if (!currentUser || !userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const roleFromDb = await fetchUserRoleFromDb(userId);
    if (!roleFromDb) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }
    const roleFromToken = typeof currentUser.role === 'string' ? currentUser.role : null;

    if (roleFromToken && roleFromToken !== roleFromDb) {
      console.warn(
        `[refreshUserRole] Divergência de role para user ${userId}: token=${roleFromToken}, db=${roleFromDb}`
      );
    }

    // Admin GLOBAL do SSO (superusuário) não é rebaixado pela role local.
    const isGlobalAdmin = currentUser.is_global_admin === true;

    req.user = {
      ...currentUser,
      role: isGlobalAdmin ? 'admin' : roleFromDb,
      role_source: 'db',
    };

    return next();
  } catch (err) {
    console.error('[refreshUserRole] Erro ao consultar role no banco:', err);
    return res.status(503).json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
  }
};
