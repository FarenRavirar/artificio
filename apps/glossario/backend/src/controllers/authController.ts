import { Response } from 'express';
import { db } from '../config/database';

/**
 * Login de sessão e cadastro legados foram DESATIVADOS (spec 015): o único login
 * é Google OAuth via accounts. (D018). BCrypt vive só no fluxo de reivindicação
 * (`/api/migration/verify`). Estes endpoints respondem 410 Gone.
 */
export const gone = (_req: unknown, res: Response) => {
  return res.status(410).json({
    message:
      'O login por email/senha foi descontinuado. Entre com sua conta Google. ' +
      'Cadastrou no glossário antigo com email não-Google? Use o fluxo de migração.',
  });
};

export const getMe = async (req: any, res: Response) => {
  try {
    const result = await db.query(
      'SELECT id, full_name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar perfil.' });
  }
};
