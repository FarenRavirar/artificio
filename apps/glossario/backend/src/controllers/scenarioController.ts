import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { slugify } from '../utils/slugify.js';
import { getCatalogNameMap } from '../services/catalogClient.js';
import type { AuthedRequest } from '../types/express.js';

interface ScenarioRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  system_id: string | null;
  status: string;
  suggested_by: string | null;
}

function normalizeScenarioRow(row: unknown): ScenarioRow | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.slug !== 'string' || typeof r.status !== 'string') {
    return null;
  }
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: typeof r.description === 'string' ? r.description : null,
    system_id: typeof r.system_id === 'string' ? r.system_id : null,
    status: r.status,
    suggested_by: typeof r.suggested_by === 'string' ? r.suggested_by : null,
  };
}

export const listScenarios = async (req: AuthedRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const where = isAdmin ? '' : "WHERE sc.status = 'aprovado'";
    const result = await db.query(`SELECT sc.* FROM scenarios sc ${where} ORDER BY sc.name`);
    const names = await getCatalogNameMap();
    const scenarios = result.rows
      .map(normalizeScenarioRow)
      .filter((row): row is ScenarioRow => row !== null);
    res.json(scenarios.map((row) => ({
      ...row,
      system_name: row.system_id ? names.get(row.system_id) ?? null : null,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erro ao listar cenários.' }); }
};

export const createScenario = async (req: AuthedRequest, res: Response) => {
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
