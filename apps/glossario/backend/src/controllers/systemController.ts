import { Request, Response } from 'express';
import { db } from '../config/database';
import { slugify } from '../utils/slugify';
import {
  archiveCatalogNode,
  checkCatalogHealth,
  createCatalogEdition,
  createCatalogSystem,
  findCatalogNode,
  listCatalogEditions,
  listCatalogSystems,
  updateCatalogEdition,
  updateCatalogSystem,
} from '../services/catalogClient';

interface CatalogNodeWriteDto {
  name: string;
  slug: string | null;
  description: string | null;
}

// Achado CodeRabbit (PR #145): req.body chegava como `any` sem validacao —
// name ausente/nao-string faz slugify(name) falhar e nomes nao normalizados
// eram encaminhados ao write administrativo central. Valida antes de usar.
function parseCatalogNodeWrite(body: unknown): CatalogNodeWriteDto | null {
  if (typeof body !== 'object' || body === null) return null;
  const { name, slug, description } = body as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim().length === 0) return null;
  return {
    name: name.trim(),
    slug: typeof slug === 'string' && slug.trim().length > 0 ? slug.trim() : null,
    description: typeof description === 'string' && description.trim().length > 0 ? description.trim() : null,
  };
}

export const catalogHealth = async (_req: Request, res: Response) => {
  try {
    res.json({ status: 'ok', catalog: await checkCatalogHealth() });
  } catch (err) {
    console.error('[glossario/catalog] health failed', err);
    res.status(503).json({ status: 'error', message: 'Catálogo central indisponível.' });
  }
};

export const listSystems = async (_req: any, res: Response) => {
  try {
    res.json(await listCatalogSystems());
  } catch (err) {
    console.error('[glossario/catalog] list systems failed', err);
    res.status(503).json({ message: 'Catálogo central indisponível.' });
  }
};

export const createSystem = async (req: any, res: Response) => {
  const parsed = parseCatalogNodeWrite(req.body);
  if (!parsed) return res.status(400).json({ message: 'Nome é obrigatório.' });
  try {
    const system = await createCatalogSystem({
      name: parsed.name,
      slug: parsed.slug || slugify(parsed.name),
      description: parsed.description,
      // Achado CodeRabbit (PR #145): rota permite membro comum (só bloqueia em
      // beta via betaWriteGuard); sem gate de role, publicava direto 'active'
      // no catálogo compartilhado mesmo vindo de quem não é admin.
      status: req.user?.role === 'admin' ? 'active' : 'pending',
    });
    res.status(201).json(system);
  } catch (err) {
    console.error('[glossario/catalog] create system failed', err);
    res.status(503).json({ message: 'Erro ao criar sistema no catálogo central.' });
  }
};

export const updateSystem = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = parseCatalogNodeWrite(req.body);
  if (!parsed) return res.status(400).json({ message: 'Nome é obrigatório.' });
  try {
    const existing = await findCatalogNode(id);
    if (!existing) return res.status(404).json({ message: 'Sistema não encontrado.' });
    // Achado CodeRabbit (PR #145): updateCatalogSystem forca node_type:'system';
    // sem checar o tipo real, chamar esta rota com o UUID de uma edicao
    // converteria/reparentearia o no silenciosamente.
    if (existing.node_type !== 'system') {
      return res.status(400).json({ message: 'ID não corresponde a um sistema.' });
    }
    const system = await updateCatalogSystem(id, {
      name: parsed.name,
      slug: parsed.slug || slugify(parsed.name),
      description: parsed.description,
    });
    res.json(system);
  } catch (err) {
    console.error('[glossario/catalog] update system failed', err);
    res.status(503).json({ message: 'Erro ao atualizar sistema no catálogo central.' });
  }
};

export const deleteSystem = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await findCatalogNode(id);
    if (!existing) return res.status(404).json({ message: 'Sistema não encontrado.' });
    if (existing.node_type !== 'system') {
      return res.status(400).json({ message: 'ID não corresponde a um sistema.' });
    }
    const linkedTerms = await countTerms('system_id', id);
    const linkedScenarios = await countScenarios(id);
    const editions = await listCatalogEditions(id);
    if (linkedTerms > 0 || linkedScenarios > 0 || editions.length > 0) {
      return res.status(409).json({
        message: 'Sistema possui referências e não pode ser arquivado.',
        blocked_by: [
          ...(linkedTerms > 0 ? [{ type: 'terms', count: linkedTerms }] : []),
          ...(linkedScenarios > 0 ? [{ type: 'scenarios', count: linkedScenarios }] : []),
          ...(editions.length > 0 ? [{ type: 'editions', count: editions.length }] : []),
        ],
      });
    }
    await archiveCatalogNode(id);
    res.status(204).send();
  } catch (err) {
    console.error('[glossario/catalog] archive system failed', err);
    res.status(503).json({ message: 'Erro ao arquivar sistema no catálogo central.' });
  }
};

export const listEditions = async (req: any, res: Response) => {
  const { systemId } = req.params;
  try {
    res.json(await listCatalogEditions(systemId));
  } catch (err) {
    console.error('[glossario/catalog] list editions failed', err);
    res.status(503).json({ message: 'Catálogo central indisponível.' });
  }
};

export const createEdition = async (req: any, res: Response) => {
  const { systemId } = req.params;
  const parsed = parseCatalogNodeWrite(req.body);
  if (!parsed) return res.status(400).json({ message: 'Nome é obrigatório.' });
  try {
    const edition = await createCatalogEdition(systemId, {
      name: parsed.name,
      slug: parsed.slug || slugify(parsed.name),
      description: parsed.description,
      status: req.user?.role === 'admin' ? 'active' : 'pending',
    });
    res.status(201).json(edition);
  } catch (err) {
    console.error('[glossario/catalog] create edition failed', err);
    res.status(503).json({ message: 'Erro ao criar edição no catálogo central.' });
  }
};

export const updateEdition = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = parseCatalogNodeWrite(req.body);
  if (!parsed) return res.status(400).json({ message: 'Nome é obrigatório.' });
  try {
    const existing = await findCatalogNode(id);
    if (!existing) return res.status(404).json({ message: 'Edição não encontrada.' });
    if (existing.node_type !== 'edition') {
      return res.status(400).json({ message: 'ID não corresponde a uma edição.' });
    }
    const edition = await updateCatalogEdition(id, {
      name: parsed.name,
      slug: parsed.slug || slugify(parsed.name),
      description: parsed.description,
    });
    res.json(edition);
  } catch (err) {
    console.error('[glossario/catalog] update edition failed', err);
    res.status(503).json({ message: 'Erro ao atualizar edição no catálogo central.' });
  }
};

export const deleteEdition = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await findCatalogNode(id);
    if (!existing) return res.status(404).json({ message: 'Edição não encontrada.' });
    if (existing.node_type !== 'edition') {
      return res.status(400).json({ message: 'ID não corresponde a uma edição.' });
    }
    const linkedTerms = await countTerms('edition_id', id);
    if (linkedTerms > 0) {
      return res.status(409).json({
        message: 'Edição possui termos vinculados e não pode ser arquivada.',
        blocked_by: [{ type: 'terms', count: linkedTerms }],
      });
    }
    await archiveCatalogNode(id);
    res.status(204).send();
  } catch (err) {
    console.error('[glossario/catalog] archive edition failed', err);
    res.status(503).json({ message: 'Erro ao arquivar edição no catálogo central.' });
  }
};

async function countTerms(field: 'system_id' | 'edition_id', id: string): Promise<number> {
  const result = await db.query(`SELECT COUNT(*)::int AS count FROM terms WHERE ${field} = $1`, [id]);
  return Number(result.rows[0]?.count ?? 0);
}

async function countScenarios(systemId: string): Promise<number> {
  const result = await db.query('SELECT COUNT(*)::int AS count FROM scenarios WHERE system_id = $1', [systemId]);
  return Number(result.rows[0]?.count ?? 0);
}
