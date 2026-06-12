import { Response, NextFunction } from 'express';
import { fetchUserRoleFromDb } from '../utils/userRole';

/**
 * Revalida a role no banco em cada requisição autenticada sensível.
 * Mitiga token JWT com claim de role desatualizado.
 */
export const refreshUserRole = async (req: any, res: Response, next: NextFunction) => {
  const userId = req?.user?.id;

  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const roleFromDb = await fetchUserRoleFromDb(userId);
    if (!roleFromDb) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }
    const roleFromToken = typeof req?.user?.role === 'string' ? req.user.role : null;

    if (roleFromToken && roleFromToken !== roleFromDb) {
      console.warn(
        `[refreshUserRole] Divergência de role para user ${userId}: token=${roleFromToken}, db=${roleFromDb}`
      );
    }

    // Admin GLOBAL do SSO (superusuário) não é rebaixado pela role local.
    const isGlobalAdmin = req?.user?.is_global_admin === true;

    req.user = {
      ...req.user,
      role: isGlobalAdmin ? 'admin' : roleFromDb,
      role_source: 'db',
    };

    return next();
  } catch (err) {
    console.error('[refreshUserRole] Erro ao consultar role no banco:', err);
    return res.status(503).json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
  }
};
