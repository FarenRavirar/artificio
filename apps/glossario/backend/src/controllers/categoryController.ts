import { Request, Response } from 'express';
import { db } from '../config/database';
import { slugify } from '../utils/slugify';
import type { AuthedRequest } from '../types/express';

export const listCategories = async (req: AuthedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const where = isAdmin ? '' : "WHERE status = 'aprovado'";
    const result = await db.query(`SELECT * FROM categories ${where} ORDER BY type, position, name`);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao listar categorias.' }); }
};

export const createCategory = async (req: AuthedRequest, res: Response) => {
  const { name, slug, type, parent_id, position } = req.body;
  const isAdmin = req.user?.role === 'admin';
  const status = isAdmin ? 'aprovado' : 'pendente';
  const finalSlug = slug || slugify(name);
  try {
    const result = await db.query(
      'INSERT INTO categories (name, slug, type, parent_id, position, status, suggested_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, finalSlug, type, parent_id || null, position || 0, status, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao criar categoria.' }); }
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, slug, type, parent_id, position, status } = req.body;
  try {
    const result = await db.query(
      'UPDATE categories SET name=$1, slug=$2, type=$3, parent_id=$4, position=$5, status=$6 WHERE id=$7 RETURNING *',
      [name, slug, type, parent_id || null, position || 0, status || 'aprovado', id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao atualizar categoria.' }); }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM categories WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao excluir categoria.' }); }
};
