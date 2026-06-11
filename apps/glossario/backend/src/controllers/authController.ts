import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { notifyAdminsOnUserRegistration } from '../services/notificationService';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const register = async (req: Request, res: Response) => {
  const { full_name, username, email, password } = req.body;

  try {
    const userExists = await db.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'E-mail ou Usuário já cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Promoção automática para Admin se for o e-mail do mantenedor
    const role = email === 'paulohenriquercc@gmail.com' ? 'admin' : 'member';

    const result = await db.query(
      'INSERT INTO users (full_name, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, username, email, role',
      [full_name, username, email, passwordHash, role]
    );

    const user = result.rows[0];

    try {
      await notifyAdminsOnUserRegistration({
        newUserId: user.id,
        fullName: user.full_name ?? null,
        username: user.username ?? null,
      });
    } catch (notifyError) {
      console.error('[notifications] Falha ao gerar notificação de novo usuário:', notifyError);
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao registrar usuário.' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1 OR username = $1', [identifier]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Credenciais inválidas.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao fazer login.' });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const result = await db.query('SELECT id, full_name, email, role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar perfil.' });
  }
};
