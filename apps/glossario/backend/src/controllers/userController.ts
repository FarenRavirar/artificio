import { Request, Response } from 'express';
import { db } from '../config/database';
import type { AuthedRequest } from '../types/express';

export const listUsers = async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, full_name, username, email, role, banned, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao listar usuários.' });
  }
};

export const toggleBan = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { banned } = req.body;

  try {
    const result = await db.query('UPDATE users SET banned = $1 WHERE id = $2 RETURNING id, full_name, banned', [banned, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao gerenciar banimento.' });
  }
};

export const updateProfile = async (req: AuthedRequest, res: Response) => {
  const { full_name } = req.body;

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET full_name = $1 WHERE id = $2 RETURNING id, full_name, username, email, role',
      [full_name, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar perfil.' });
  }
};
