import { Request } from 'express';

/**
 * Shape de `req.user` populado por `authMiddleware`/`optionalAuthMiddleware`.
 * Papel global vem exclusivamente do token SSO emitido pelo accounts.
 */
export interface AuthedUser {
  id: string;
  role: string;
  role_source: 'sso';
  is_global_admin: boolean;
  is_global_moderator: boolean;
  email: string;
  name: string;
  sub: string;
  sso_email: string;
}

/**
 * Request com `user` opcional (populado só após authMiddleware/optionalAuthMiddleware
 * rodar). Controllers atrás de authMiddleware podem assumir presença; os que usam
 * optionalAuthMiddleware devem tratar `undefined`.
 */
export interface AuthedRequest extends Request {
  user?: AuthedUser;
}
