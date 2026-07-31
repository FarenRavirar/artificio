import { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../types/express.js';

function betaReadonlyBlocksMembers(): boolean {
  return process.env.APP_ENV === 'beta' && process.env.BETA_READONLY_MEMBERS === 'true';
}

/**
 * Bloqueia escrita de membros no ambiente beta quando a flag de proteção estiver ativa.
 * Admins continuam com acesso para testes controlados.
 */
export const betaWriteGuard = (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (betaReadonlyBlocksMembers() && req.user?.role === 'member') {
    return res.status(403).json({
      message: 'Ambiente beta: contribuições de membros estão temporariamente bloqueadas.',
    });
  }

  return next();
};

/**
 * Igual ao `betaWriteGuard`, mas isenta moderador global — para rotas de
 * **moderação**, não de contribuição.
 *
 * Por que existe: `refreshUserRole` colapsa o papel em 'member' quando não é
 * `is_global_admin`, então o guard comum responderia 403 antes de
 * `deleteComment`, que reconhece `is_global_moderator`. A moderação ficaria
 * inoperante em beta, incluindo o botão da spec 090 (achado de review, PR #233).
 *
 * A isenção NÃO vive no `betaWriteGuard`: ele é compartilhado por social, term,
 * system, scenario, category, user e import — colocar a exceção lá liberaria
 * moderador global para votar, comentar, editar perfil, sugerir e importar em
 * beta, muito além de moderar (2ª passada do review). Aplicar somente na rota
 * de exclusão moderativa.
 */
export const betaModerationGuard = (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (req.user?.is_global_moderator === true) {
    return next();
  }

  return betaWriteGuard(req, res, next);
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
