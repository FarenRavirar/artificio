import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import type { SystemNodeType } from '../db/types';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  archiveCatalogNode,
  checkCatalogHealth,
  createCatalogNode,
  filterCatalogTree,
  flattenTree,
  invalidateCatalogCache,
  loadCatalogFlat,
  loadCatalogTree,
  updateCatalogNode,
} from '../services/catalogClient';

export { slugifyCatalogSegment as slugify } from '../services/catalogClient';

const router = Router();

export const VALID_PARENT: Record<SystemNodeType, SystemNodeType[] | null> = {
  system: null,
  edition: ['system'],
  subsystem: ['system'],
  variant: ['edition', 'subsystem'],
};

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const catalog = await checkCatalogHealth();
    return res.json({ status: 'ok', catalog });
  } catch (error) {
    console.error('[GET /systems/health] central catalog failed', error);
    return res.status(503).json({ status: 'error', error: 'Catálogo central indisponível.' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  const view = typeof req.query.view === 'string' ? req.query.view.toLowerCase() : 'flat';
  const search = typeof req.query.search === 'string'
    ? req.query.search
    : typeof req.query.q === 'string'
      ? req.query.q
      : '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  try {
    if (view === 'tree') {
      const tree = await loadCatalogTree();
      const filteredTree = search.trim().length > 0 ? filterCatalogTree(tree, search) : tree;
      return res.json({
        data: filteredTree,
        pagination: { next_cursor: null, has_more: false },
      });
    }

    const flat = await loadCatalogFlat();
    const filtered = search.trim().length > 0
      ? flattenTree(filterCatalogTree(await loadCatalogTree(), search))
      : flat;

    const shouldPaginate = limit !== undefined && limit > 0;
    const startIndex = cursor ? Math.max(filtered.findIndex((node) => node.id === cursor) + 1, 0) : 0;
    const page = shouldPaginate ? filtered.slice(startIndex, startIndex + limit + 1) : filtered;
    const hasMore = shouldPaginate && page.length > limit;
    if (hasMore) page.pop();

    return res.json({
      data: page,
      pagination: {
        // Achado Sonar (PR #145): .at(-1) em vez de [.length - 1].
        next_cursor: shouldPaginate && hasMore ? page.at(-1)?.id ?? null : null,
        has_more: shouldPaginate ? hasMore : false,
      },
    });
  } catch (error) {
    console.error('[GET /systems] central catalog failed', error);
    return res.status(503).json({ error: 'Catálogo central indisponível.' });
  }
});

router.post('/admin', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, name_pt, description, node_type, parent_id } = req.body;
  const { aliases, logo_filename, website_url } = normalizeOptionalNodeFields(req.body ?? {});

  const validationError = validateSystemInput(name, node_type, parent_id);
  if (validationError) return res.status(validationError.status).json({ error: validationError.message });

  try {
    await assertValidParent(node_type, parent_id);
    const created = await createCatalogNode({
      name,
      name_pt,
      description,
      node_type,
      parent_id,
      aliases,
      logo_filename,
      website_url,
    });
    return res.status(201).json({ data: created });
  } catch (error) {
    invalidateCatalogCache();
    return handleCatalogWriteError(error, res, '[POST /admin/systems]');
  }
});

router.put('/admin/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, name_pt, description, node_type, parent_id } = req.body;
  const { aliases, logo_filename, website_url } = normalizeOptionalNodeFields(req.body ?? {});

  const validationError = validateSystemInput(name, node_type, parent_id);
  if (validationError) return res.status(validationError.status).json({ error: validationError.message });

  try {
    const exists = (await loadCatalogFlat()).some((node) => node.id === id);
    if (!exists) return res.status(404).json({ error: 'Sistema não encontrado.' });

    await assertValidParent(node_type, parent_id);
    const updated = await updateCatalogNode(id, {
      name,
      name_pt,
      description,
      node_type,
      parent_id,
      aliases,
      logo_filename,
      website_url,
    });
    return res.json({ data: updated });
  } catch (error) {
    invalidateCatalogCache();
    return handleCatalogWriteError(error, res, '[PUT /admin/systems/:id]');
  }
});

router.delete('/admin/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const existing = (await loadCatalogFlat()).find((node) => node.id === id);
    if (!existing) return res.status(404).json({ error: 'Sistema não encontrado.' });

    const tablesBlocked = await countLocalTables(id);
    const childrenBlocked = existing.children_count;
    const blockedBy: Array<{ type: 'tables' | 'children'; count: number }> = [];
    if (tablesBlocked > 0) blockedBy.push({ type: 'tables', count: tablesBlocked });
    if (childrenBlocked > 0) blockedBy.push({ type: 'children', count: childrenBlocked });

    if (blockedBy.length > 0) {
      const details = blockedBy
        .map((item) => item.type === 'tables' ? `${item.count} mesa(s) vinculada(s)` : `${item.count} sistema(s) filho(s)`)
        .join(' e ');
      return res.status(409).json({ error: `Não é possível arquivar este sistema. Bloqueado por ${details}.`, blocked_by: blockedBy });
    }

    await archiveCatalogNode(id);
    return res.json({ data: { message: 'Sistema arquivado no catálogo central.' } });
  } catch (error) {
    invalidateCatalogCache();
    return handleCatalogWriteError(error, res, '[DELETE /admin/systems/:id]');
  }
});

// Achado CodeRabbit (PR #145): aliases/logo_filename/website_url saiam direto
// de req.body sem normalizacao — aliases aceitava itens nao-string, os outros
// podiam carregar qualquer JSON pro payload do catalogo central.
function normalizeOptionalNodeFields(body: Record<string, unknown>): {
  aliases: string[] | undefined;
  logo_filename: string | null | undefined;
  website_url: string | null | undefined;
} {
  const aliases = Array.isArray(body.aliases)
    ? body.aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : undefined;
  return {
    aliases,
    logo_filename: normalizeOptionalTrimmedString(body.logo_filename),
    website_url: normalizeOptionalTrimmedString(body.website_url),
  };
}

// Achado Sonar (PR #145): ternario aninhado extraido pra funcao independente.
function normalizeOptionalTrimmedString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

function validateSystemInput(name: unknown, nodeType: unknown, parentId: unknown): { status: number; message: string } | null {
  if (typeof name !== 'string' || name.trim().length === 0 || typeof nodeType !== 'string') {
    return { status: 400, message: 'Nome e tipo são obrigatórios.' };
  }
  if (!['system', 'edition', 'variant', 'subsystem'].includes(nodeType)) {
    return { status: 400, message: 'Tipo inválido. Use: system, edition, variant ou subsystem.' };
  }
  if (nodeType !== 'system' && (typeof parentId !== 'string' || parentId.trim().length === 0)) {
    return { status: 400, message: `${nodeType} precisa de um sistema pai.` };
  }
  if (nodeType === 'system' && typeof parentId === 'string' && parentId.trim().length > 0) {
    return { status: 400, message: 'Sistema base não pode ter pai.' };
  }
  return null;
}

async function assertValidParent(nodeType: SystemNodeType, parentId: string | null | undefined): Promise<void> {
  const allowedParentTypes = VALID_PARENT[nodeType];
  if (!allowedParentTypes || !parentId) return;
  const parent = (await loadCatalogFlat()).find((node) => node.id === parentId);
  if (!parent) throw new Error('parent_not_found');
  if (!allowedParentTypes.includes(parent.node_type)) {
    throw new Error(`${nodeType} só pode ser filho de: ${allowedParentTypes.join(' ou ')}.`);
  }
}

async function countLocalTables(systemId: string): Promise<number> {
  const row = await db
    .selectFrom('tables')
    .select(({ fn }) => fn.count<number>('id').as('count'))
    .where('system_id', '=', systemId)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

function handleCatalogWriteError(error: unknown, res: Response, scope: string) {
  const message = error instanceof Error ? error.message : 'Erro no catálogo central.';
  if (message.includes('parent_not_found')) return res.status(404).json({ error: 'Sistema pai não encontrado.' });
  if (message.includes('duplicate')) return res.status(409).json({ error: 'Já existe um sistema com este slug.' });
  if (message.includes('só pode ser filho')) return res.status(400).json({ error: message });
  console.error(`${scope} central catalog failed`, error);
  return res.status(503).json({ error: 'Catálogo central indisponível.' });
}

export default router;
