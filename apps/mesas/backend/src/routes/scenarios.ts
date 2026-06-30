import { Router, Request, Response } from 'express';
import { sql } from 'kysely';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

interface ScenarioRecord {
  id: string;
  name: string;
  slug: string;
  subgenres: string[];
}

const normalizeText = (value: string): string => value.trim().toLowerCase();

// Função auxiliar para gerar slug
const slugify = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// GET /api/v1/scenarios — Listar todos os cenários
// Suporta paginação cursor-based: ?limit=50&cursor=abc123
router.get('/', async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string'
    ? req.query.search
    : typeof req.query.q === 'string'
      ? req.query.q
      : '';
  
  // Paginação cursor-based
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  try {
    const shouldPaginate = limit !== undefined && limit > 0;

    let query = db
      .selectFrom('scenarios')
      .select(['id', 'name', 'name_pt', 'slug', 'subgenres'])
      .orderBy('name', 'asc');

    // Aplicar cursor (continuar de onde parou)
    if (shouldPaginate && cursor) {
      query = query.where('id', '>', cursor);
    }

    // Aplicar limit (+1 para detectar has_more)
    if (shouldPaginate) {
      query = query.limit(limit + 1);
    }

    const scenarios = await query.execute() as ScenarioRecord[];

    // Detectar se há mais páginas
    let hasMore = false;
    let nextCursor: string | null = null;
    
    if (shouldPaginate && scenarios.length > limit) {
      hasMore = true;
      scenarios.pop(); // Remove o item extra
      nextCursor = scenarios[scenarios.length - 1]?.id || null;
    }

    // Busca full-text se houver query
    if (search.trim().length > 0) {
      const normalizedSearch = normalizeText(search);
      
      // Filtrar no backend (busca em name, slug e subgenres)
      const filtered = scenarios.filter((scenario) => {
        return normalizeText(scenario.name).includes(normalizedSearch)
          || normalizeText(scenario.slug).includes(normalizedSearch)
          || scenario.subgenres.some((subgenre) => normalizeText(subgenre).includes(normalizedSearch));
      });

      return res.json({ 
        data: filtered,
        pagination: {
          next_cursor: shouldPaginate ? nextCursor : null,
          has_more: shouldPaginate ? hasMore : false,
        },
      });
    }

    return res.json({ 
      data: scenarios,
      pagination: {
        next_cursor: shouldPaginate ? nextCursor : null,
        has_more: shouldPaginate ? hasMore : false,
      },
    });
  } catch (error: any) {
    console.error('[GET /scenarios]', error);
    return res.status(500).json({ error: 'Erro ao buscar cenários.' });
  }
});

// GET /api/v1/scenarios/:id — Buscar cenário por ID
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const scenario = await db
      .selectFrom('scenarios')
      .select(['id', 'name', 'name_pt', 'slug', 'subgenres'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!scenario) {
      return res.status(404).json({ error: 'Cenário não encontrado.' });
    }

    return res.json({ data: scenario });
  } catch (error: any) {
    console.error('[GET /scenarios/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar cenário.' });
  }
});

// =============================================================================
// ROTAS ADMINISTRATIVAS (CRUD)
// =============================================================================

// POST /api/v1/admin/scenarios — Criar novo cenário
router.post('/admin', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, name_pt, subgenres } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }

  try {
    const slug = slugify(name);

    // Verificar se slug já existe
    const existing = await db
      .selectFrom('scenarios')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst();

    if (existing) {
      return res.status(409).json({ error: 'Já existe um cenário com este slug.' });
    }

    // Validar subgenres como array
    const subgenresArray = Array.isArray(subgenres) ? subgenres : [];

    // Inserir cenário
    const newScenario = await db
      .insertInto('scenarios')
      .values({
        name,
        name_pt: name_pt || null,
        slug,
        subgenres: subgenresArray,
      })
      .returning(['id', 'name', 'name_pt', 'slug', 'subgenres'])
      .executeTakeFirst();

    return res.status(201).json({ data: newScenario });
  } catch (error: any) {
    console.error('[POST /admin/scenarios]', error);
    return res.status(500).json({ error: 'Erro ao criar cenário.' });
  }
});

// PUT /api/v1/admin/scenarios/:id — Editar cenário
router.put('/admin/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, name_pt, subgenres } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }

  try {
    // Verificar se cenário existe
    const existing = await db
      .selectFrom('scenarios')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ error: 'Cenário não encontrado.' });
    }

    const slug = slugify(name);

    // Verificar se slug já existe em outro cenário
    const duplicateSlug = await db
      .selectFrom('scenarios')
      .select('id')
      .where('slug', '=', slug)
      .where('id', '!=', id)
      .executeTakeFirst();

    if (duplicateSlug) {
      return res.status(409).json({ error: 'Já existe outro cenário com este slug.' });
    }

    // Validar subgenres como array
    const subgenresArray = Array.isArray(subgenres) ? subgenres : [];

    // Atualizar cenário
    const updated = await db
      .updateTable('scenarios')
      .set({
        name,
        name_pt: name_pt || null,
        slug,
        subgenres: subgenresArray,
      })
      .where('id', '=', id)
      .returning(['id', 'name', 'name_pt', 'slug', 'subgenres'])
      .executeTakeFirst();

    return res.json({ data: updated });
  } catch (error: any) {
    console.error('[PUT /admin/scenarios/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar cenário.' });
  }
});

// DELETE /api/v1/admin/scenarios/:id — Deletar cenário
router.delete('/admin/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Verificar se cenário existe
    const existing = await db
      .selectFrom('scenarios')
      .select('name')
      .where('id', '=', id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ error: 'Cenário não encontrado.' });
    }

    // Verificar se há mesas vinculadas
    const tablesCount = await db
      .selectFrom('tables')
      .select(sql<number>`COUNT(id)::int`.as('count'))
      .where('scenario_id', '=', id)
      .executeTakeFirst();

    if (tablesCount && Number(tablesCount.count) > 0) {
      return res.status(409).json({
        error: `Não é possível deletar este cenário. Existem ${tablesCount.count} mesa(s) vinculada(s).`,
      });
    }

    // Deletar cenário
    await db
      .deleteFrom('scenarios')
      .where('id', '=', id)
      .execute();

    return res.json({ data: { message: 'Cenário deletado com sucesso.' } });
  } catch (error: any) {
    console.error('[DELETE /admin/scenarios/:id]', error);
    return res.status(500).json({ error: 'Erro ao deletar cenário.' });
  }
});

export default router;
