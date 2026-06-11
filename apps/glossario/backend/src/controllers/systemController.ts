import { Request, Response } from 'express';
import { db } from '../config/database';
import { slugify } from '../utils/slugify';

// --- SYSTEMS ---
export const listSystems = async (req: any, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const where = isAdmin ? '' : "WHERE status = 'aprovado'";
    const result = await db.query(`SELECT * FROM systems ${where} ORDER BY name`);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao listar sistemas.' }); }
};

export const createSystem = async (req: any, res: Response) => {
  const { name, slug, description } = req.body;
  const isAdmin = req.user?.role === 'admin';
  const status = isAdmin ? 'aprovado' : 'pendente';
  const finalSlug = slug || slugify(name);
  try {
    const result = await db.query(
      'INSERT INTO systems (name, slug, description, status, suggested_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, finalSlug, description, status, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao criar sistema.' }); }
};

export const updateSystem = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, slug, description, status } = req.body;
  try {
    const result = await db.query(
      'UPDATE systems SET name=$1, slug=$2, description=$3, status=$4 WHERE id=$5 RETURNING *',
      [name, slug, description, status || 'aprovado', id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao atualizar sistema.' }); }
};

export const deleteSystem = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM systems WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao excluir sistema.' }); }
};

// --- EDITIONS ---
export const listEditions = async (req: any, res: Response) => {
  const { systemId } = req.params;
  try {
    const isAdmin = req.user?.role === 'admin';
    const where = isAdmin ? '' : "AND status = 'aprovado'";
    const result = await db.query(`SELECT * FROM editions WHERE system_id=$1 ${where} ORDER BY name`, [systemId]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao listar edições.' }); }
};

export const createEdition = async (req: any, res: Response) => {
  const { systemId } = req.params;
  const { name, slug, description } = req.body;
  const isAdmin = req.user?.role === 'admin';
  const status = isAdmin ? 'aprovado' : 'pendente';
  const finalSlug = slug || slugify(name);
  try {
    const result = await db.query(
      'INSERT INTO editions (system_id, name, slug, description, status, suggested_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [systemId, name, finalSlug, description, status, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao criar edição.' }); }
};

export const updateEdition = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, slug, description, status } = req.body;
  try {
    const result = await db.query(
      'UPDATE editions SET name=$1, slug=$2, description=$3, status=$4 WHERE id=$5 RETURNING *',
      [name, slug, description, status || 'aprovado', id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao atualizar edição.' }); }
};

export const deleteEdition = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM editions WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao excluir edição.' }); }
};
