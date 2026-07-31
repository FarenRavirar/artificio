import { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../types/express.js';

/**
 * Adaptador legado mantido na cadeia das rotas. Normaliza o papel efetivo a
 * partir da sessão do accounts.; não consulta nem confia no papel local.
 */
export const refreshUserRole = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const currentUser = req.user;
  const userId = currentUser?.id;

  if (!currentUser || !userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  // Papel global vem só do accounts. Papel local nunca é fallback de
  // autorização; este middleware preserva a forma esperada pelas rotas antigas.
  req.user = {
    ...currentUser,
    role: currentUser.is_global_admin ? 'admin' : 'member',
    role_source: 'sso',
  };

  return next();
};
