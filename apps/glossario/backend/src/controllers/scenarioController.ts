import { Request, Response } from 'express';
import { db } from '../config/database';
import { slugify } from '../utils/slugify';
import { getCatalogNameMap } from '../services/catalogClient';

export const listScenarios = async (req: any, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const where = isAdmin ? '' : "WHERE sc.status = 'aprovado'";
    const result = await db.query(`SELECT sc.* FROM scenarios sc ${where} ORDER BY sc.name`);
    const names = await getCatalogNameMap();
    res.json(result.rows.map((row) => ({
      ...row,
      system_name: row.system_id ? names.get(row.system_id) ?? null : null,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao listar cenários.' }); }
};

export const createScenario = async (req: any, res: Response) => {
  const { name, slug, description, system_id } = req.body;
  const isAdmin = req.user?.role === 'admin';
  const status = isAdmin ? 'aprovado' : 'pendente';
  const finalSlug = slug || slugify(name);
  try {
    const result = await db.query(
      'INSERT INTO scenarios (name, slug, description, system_id, status, suggested_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, finalSlug, description, system_id || null, status, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao criar cenário.' }); }
};

export const updateScenario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, slug, description, status } = req.body;
  try {
    const result = await db.query(
      'UPDATE scenarios SET name=$1, slug=$2, description=$3, status=$4 WHERE id=$5 RETURNING *',
      [name, slug, description, status || 'aprovado', id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao atualizar cenário.' }); }
};

export const deleteScenario = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM scenarios WHERE id=$1', [id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao excluir cenário.' }); }
};
