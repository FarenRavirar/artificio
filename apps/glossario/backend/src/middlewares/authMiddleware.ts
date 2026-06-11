import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { fetchUserRoleFromDb, normalizeRole } from '../utils/userRole';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Middleware para verificar se o usuário está autenticado.
 */
export const authMiddleware = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Sessão inválida ou expirada.' });
  }
};

/**
 * Middleware para restringir acesso apenas a administradores.
 * Deve ser usado APÓS o authMiddleware.
 */
export const adminMiddleware = (req: any, res: Response, next: NextFunction) => {
  const currentRole = normalizeRole(req?.user?.role);
  const roleSource = req?.user?.role_source;

  if (currentRole === 'admin' && roleSource === 'db') {
    return next();
  }

  const userId = req?.user?.id;
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  fetchUserRoleFromDb(userId)
    .then((roleFromDb) => {
      if (!roleFromDb) {
        return res.status(401).json({ message: 'Usuário não encontrado.' });
      }

      req.user = {
        ...req.user,
        role: roleFromDb,
        role_source: 'db',
      };

      if (roleFromDb !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a administradores.' });
      }

      return next();
    })
    .catch((err) => {
      console.error('[adminMiddleware] Erro ao revalidar role no banco:', err);
      return res.status(503).json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
    });
};
