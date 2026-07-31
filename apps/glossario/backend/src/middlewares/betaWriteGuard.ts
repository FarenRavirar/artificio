import { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../types/express.js';

/**
 * Bloqueia escrita de membros no ambiente beta quando a flag de proteção estiver ativa.
 * Admins continuam com acesso para testes controlados.
 *
 * Moderador global também passa: `refreshUserRole` colapsa o papel em 'member'
 * (só `is_global_admin` vira 'admin'), então sem esta exceção o guard responderia
 * 403 antes de `deleteComment` — que reconhece `is_global_moderator` — e a
 * moderação ficaria inoperante em beta, incluindo o botão novo da spec 090
 * (achado de review, PR #233). O guard existe para barrar *contribuição* de
 * membro, não ação de moderação.
 */
export const betaWriteGuard = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const isBeta = process.env.APP_ENV === 'beta';
  const blockMembers = process.env.BETA_READONLY_MEMBERS === 'true';
  const userRole = req.user?.role;
  const isGlobalModerator = req.user?.is_global_moderator === true;

  if (isBeta && blockMembers && userRole === 'member' && !isGlobalModerator) {
    return res.status(403).json({
      message: 'Ambiente beta: contribuições de membros estão temporariamente bloqueadas.',
    });
  }

  return next();
};

/**
 * Bloqueia endpoints públicos de escrita (ex.: registro) quando o beta está em modo somente leitura para membros.
 */
export const betaPublicWriteGuard = (_req: Request, res: Response, next: NextFunction) => {
  const isBeta = process.env.APP_ENV === 'beta';
  const blockMembers = process.env.BETA_READONLY_MEMBERS === 'true';

  if (isBeta && blockMembers) {
    return res.status(403).json({
      message: 'Ambiente beta em modo somente leitura para cadastro público.',
    });
  }

  return next();
};
