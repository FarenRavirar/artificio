import { Request } from 'express';

/**
 * Shape de `req.user` populado por `authMiddleware`/`optionalAuthMiddleware`
 * (ver src/middlewares/authMiddleware.ts). `role_source` distingue claim vindo
 * do token SSO ('sso') de revalidação no banco ('db', ver adminMiddleware).
 */
export interface AuthedUser {
  id: string;
  role: string;
  role_source: 'sso' | 'db';
  is_global_admin: boolean;
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
