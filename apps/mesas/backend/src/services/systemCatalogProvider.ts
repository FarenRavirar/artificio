import { randomUUID } from 'node:crypto';
import type { Transaction } from 'kysely';
import { db } from '../db';
import type { Database, SystemNodeType } from '../db/types';
import {
  archiveCatalogNode,
  checkCatalogHealth,
  createCatalogNode,
  loadCatalogFlat,
  loadCatalogTree,
  slugifyCatalogSegment,
  updateCatalogNode,
  type CatalogNodeInput,
  type MesasSystemNode,
} from './catalogClient';
import { validateSystemParentType } from './systemHierarchy';

export type SystemCatalogSource = 'central' | 'local';

export interface SystemCatalogReader {
  readonly source: SystemCatalogSource;
  loadTree(forceRefresh?: boolean): Promise<MesasSystemNode[]>;
  loadFlat(forceRefresh?: boolean): Promise<MesasSystemNode[]>;
  exists(systemId: string): Promise<boolean>;
  resolveBySlug(slug: string): Promise<MesasSystemNode | null>;
}

export interface SystemCatalogProvider extends SystemCatalogReader {
  checkHealth(): Promise<{ source: SystemCatalogSource; nodes_count: number; version?: number }>;
  createNode(input: CatalogNodeInput): Promise<MesasSystemNode>;
  updateNode(id: string, input: CatalogNodeInput): Promise<MesasSystemNode | null>;
  archiveNode(id: string): Promise<void>;
}

/**
 * Resolve a fonte do domínio sistemas de RPG.
 *
 * APP_ENV é o sinal de deploy canônico do Mesas: production usa o Central
 * Site Prod; beta usa a projeção local. Ausência em processo production é
 * erro de configuração, nunca fallback silencioso para a fonte errada.
 */
export function resolveSystemCatalogSource(
  appEnv = process.env.APP_ENV,
  nodeEnv = process.env.NODE_ENV,
): SystemCatalogSource {
  const app = appEnv?.trim().toLowerCase();
  const node = nodeEnv?.trim().toLowerCase();

  if (app === 'production' || app === 'prod') return 'central';
  if (app === 'beta' || app === 'development' || app === 'test' || app === 'local') return 'local';
  if (!app && (node === 'development' || node === 'test')) return 'local';

  throw new Error(`system_catalog_environment_invalid:${app || 'missing'}`);
}

const centralProvider: SystemCatalogProvider = {
  source: 'central',
  loadTree: loadCatalogTree,
  loadFlat: loadCatalogFlat,
  async exists(systemId) {
    return (await loadCatalogFlat()).some((node) => node.id === systemId);
  },
  async resolveBySlug(slug) {
    return (await loadCatalogFlat()).find((node) => node.slug === slug || node.path_slug === slug) ?? null;
  },
  createNode: createCatalogNode,
  updateNode: updateCatalogNode,
  archiveNode: archiveCatalogNode,
  async checkHealth() {
    const health = await checkCatalogHealth();
    return { source: 'central', nodes_count: health.nodes_count, version: health.catalog_version };
  },
};

const localProvider: SystemCatalogProvider = {
  source: 'local',
  loadTree: loadLocalTree,
  loadFlat: loadLocalFlat,
  async exists(systemId) {
    const row = await db.selectFrom('systems')
      .select('id')
      .where('id', '=', systemId)
      .where('catalog_status', '=', 'active')
      .executeTakeFirst();
    return Boolean(row);
  },
  async resolveBySlug(slug) {
    return (await loadLocalFlat()).find((node) => node.slug === slug || node.path_slug === slug) ?? null;
  },
  createNode: createLocalNode,
  updateNode: updateLocalNode,
  archiveNode: archiveLocalNode,
  async checkHealth() {
    return { source: 'local', nodes_count: (await loadLocalFlat()).length };
  },
};

export function getSystemCatalogReader(): SystemCatalogReader {
  return getSystemCatalogProvider();
}

export function getSystemCatalogProvider(): SystemCatalogProvider {
  return resolveSystemCatalogSource() === 'central' ? centralProvider : localProvider;
}

export const loadSystemCatalogTree = (forceRefresh = false) => getSystemCatalogProvider().loadTree(forceRefresh);
export const loadSystemCatalogFlat = (forceRefresh = false) => getSystemCatalogProvider().loadFlat(forceRefresh);

export async function systemExistsInCatalog(systemId: string): Promise<boolean> {
  try {
    return await getSystemCatalogProvider().exists(systemId);
  } catch (error) {
    console.error('[systemExistsInCatalog] Fonte de sistemas indisponível:', error);
    return true;
  }
}

export async function resolveSystemIdBySlug(slug: string): Promise<string | null> {
  try {
    return (await getSystemCatalogProvider().resolveBySlug(slug))?.id ?? null;
  } catch (error) {
    console.error('[resolveSystemIdBySlug] Fonte de sistemas indisponível:', error);
    return null;
  }
}

export type TableSystemFields = {
  system_name: string | null;
  system_slug: string | null;
  system_path: string | null;
  system_logo_filename: string | null;
  system_website_url: string | null;
};

export async function hydrateTableSystemFields<T extends { system_id: string | null }>(
  rows: T[],
): Promise<Array<T & TableSystemFields>> {
  let flat: MesasSystemNode[];
  try {
    flat = await getSystemCatalogProvider().loadFlat();
  } catch (error) {
    console.error('[hydrateTableSystemFields] Fonte de sistemas indisponível:', error);
    return rows.map((row) => ({ ...row, ...EMPTY_SYSTEM_FIELDS }));
  }
  const byId = new Map(flat.map((node) => [node.id, node]));
  return rows.map((row) => {
    const node = row.system_id ? byId.get(row.system_id) : undefined;
    return {
      ...row,
      system_name: node ? composeSystemDisplayName(node, byId) : null,
      system_slug: node?.slug ?? null,
      system_path: node?.path_slug ?? null,
      system_logo_filename: node?.logo_filename ?? null,
      system_website_url: node?.website_url ?? null,
    };
  });
}

const EMPTY_SYSTEM_FIELDS: TableSystemFields = {
  system_name: null,
  system_slug: null,
  system_path: null,
  system_logo_filename: null,
  system_website_url: null,
};

function composeSystemDisplayName(node: MesasSystemNode, byId: Map<string, MesasSystemNode>): string {
  const chain = [node.name];
  const visited = new Set([node.id]);
  let parentId = node.parent_id;
  while (parentId && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    visited.add(parentId);
    chain.unshift(parent.name);
    parentId = parent.parent_id;
  }
  return chain.join(' ');
}

async function loadLocalFlat(): Promise<MesasSystemNode[]> {
  const [systems, aliases, tableCounts] = await Promise.all([
    db.selectFrom('systems')
      .select([
        'id', 'name', 'name_pt', 'slug', 'parent_id', 'node_type', 'depth',
        'path_slug', 'description', 'logo_filename', 'website_url',
      ])
      .where('catalog_status', '=', 'active')
      .orderBy('depth', 'asc')
      .orderBy('name', 'asc')
      .execute(),
    db.selectFrom('system_aliases').select(['system_id', 'alias']).execute(),
    db.selectFrom('tables')
      .select(({ fn }) => ['system_id', fn.count<number>('id').as('count')])
      .where('system_id', 'is not', null)
      .groupBy('system_id')
      .execute(),
  ]);

  const aliasesBySystem = new Map<string, string[]>();
  for (const alias of aliases) {
    const current = aliasesBySystem.get(alias.system_id) ?? [];
    current.push(alias.alias);
    aliasesBySystem.set(alias.system_id, current);
  }
  const countsBySystem = new Map(
    tableCounts.map((row) => [row.system_id!, Number(row.count ?? 0)]),
  );
  const childrenCount = new Map<string, number>();
  for (const system of systems) {
    if (system.parent_id) childrenCount.set(system.parent_id, (childrenCount.get(system.parent_id) ?? 0) + 1);
  }

  return systems.map((system) => {
    const nodeAliases = aliasesBySystem.get(system.id) ?? [];
    const childCount = childrenCount.get(system.id) ?? 0;
    return {
      ...system,
      aliases: nodeAliases,
      has_children: childCount > 0,
      children_count: childCount,
      tables_count: countsBySystem.get(system.id) ?? 0,
      aliases_count: nodeAliases.length,
      children: [],
    };
  });
}

async function createLocalNode(input: CatalogNodeInput): Promise<MesasSystemNode> {
  const createdId = randomUUID();
  await db.transaction().execute(async (trx) => {
    const parent = input.parent_id
      ? await trx.selectFrom('systems')
        .select(['id', 'node_type', 'path_slug'])
        .where('id', '=', input.parent_id)
        .where('catalog_status', '=', 'active')
        .executeTakeFirst()
      : null;
    assertLocalParent(input, parent ?? null);

    const segment = slugifyCatalogSegment(input.name);
    if (!segment) throw new Error('slug_required');
    const pathSlug = parent?.path_slug ? `${parent.path_slug}/${segment}` : segment;

    await trx.insertInto('systems').values({
      id: createdId,
      name: input.name.trim(),
      name_pt: cleanOptional(input.name_pt),
      slug: pathSlug.replaceAll('/', '--'),
      description: cleanOptional(input.description),
      parent_id: input.parent_id ?? null,
      node_type: input.node_type,
      depth: depthForType(input.node_type),
      path_slug: pathSlug,
      logo_filename: input.node_type === 'system' ? cleanOptional(input.logo_filename) : null,
      website_url: input.node_type === 'system' ? cleanOptional(input.website_url) : null,
      catalog_source: 'beta',
      catalog_status: 'active',
      merged_into_id: null,
      central_version: null,
      central_synced_at: null,
    }).execute();
    await replaceLocalAliases(trx, createdId, input.aliases);
  });

  return requireLocalNode(createdId);
}

async function updateLocalNode(id: string, input: CatalogNodeInput): Promise<MesasSystemNode | null> {
  const exists = await db.selectFrom('systems')
    .select('id')
    .where('id', '=', id)
    .where('catalog_status', '=', 'active')
    .executeTakeFirst();
  if (!exists) return null;

  await db.transaction().execute(async (trx) => {
    const all = await trx.selectFrom('systems')
      .select(['id', 'name', 'parent_id', 'node_type', 'path_slug', 'catalog_status'])
      .execute();
    const parent = input.parent_id
      ? all.find((node) => node.id === input.parent_id && node.catalog_status === 'active') ?? null
      : null;
    assertLocalParent(input, parent);
    if (input.parent_id === id) throw new Error('hierarchy_cycle');

    const byParent = new Map<string, string[]>();
    for (const node of all) {
      if (!node.parent_id) continue;
      const children = byParent.get(node.parent_id) ?? [];
      children.push(node.id);
      byParent.set(node.parent_id, children);
    }
    const affected = collectDescendantIds(id, byParent);
    if (input.parent_id && affected.has(input.parent_id)) throw new Error('hierarchy_cycle');

    const targetSegment = slugifyCatalogSegment(input.name);
    if (!targetSegment) throw new Error('slug_required');
    const parentPath = parent?.path_slug ?? null;
    const targetPath = parentPath ? `${parentPath}/${targetSegment}` : targetSegment;

    await trx.updateTable('systems').set({
      name: input.name.trim(),
      name_pt: cleanOptional(input.name_pt),
      slug: targetPath.replaceAll('/', '--'),
      description: cleanOptional(input.description),
      parent_id: input.parent_id ?? null,
      node_type: input.node_type,
      depth: depthForType(input.node_type),
      path_slug: targetPath,
      logo_filename: input.node_type === 'system' ? cleanOptional(input.logo_filename) : null,
      website_url: input.node_type === 'system' ? cleanOptional(input.website_url) : null,
    }).where('id', '=', id).execute();

    const descendants = all
      .filter((node) => node.id !== id && affected.has(node.id))
      .sort((left, right) => depthForType(left.node_type) - depthForType(right.node_type));
    const paths = new Map<string, string>([[id, targetPath]]);
    for (const node of descendants) {
      const nextParentPath = node.parent_id ? paths.get(node.parent_id) : null;
      if (!nextParentPath) throw new Error(`system_catalog_local_orphan:${node.id}:${node.parent_id}`);
      const segment = slugifyCatalogSegment(node.name);
      const path = `${nextParentPath}/${segment}`;
      paths.set(node.id, path);
      await trx.updateTable('systems').set({
        slug: path.replaceAll('/', '--'),
        path_slug: path,
      }).where('id', '=', node.id).execute();
    }
    await replaceLocalAliases(trx, id, input.aliases);
  });

  return requireLocalNode(id);
}

async function archiveLocalNode(id: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const activeChild = await trx.selectFrom('systems')
      .select('id')
      .where('parent_id', '=', id)
      .where('catalog_status', '=', 'active')
      .executeTakeFirst();
    if (activeChild) throw new Error('archive_has_children');
    const result = await trx.updateTable('systems').set({
      catalog_status: 'archived',
      merged_into_id: null,
    }).where('id', '=', id).where('catalog_status', '=', 'active').executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) throw new Error('system_not_found');
  });
}

type LocalTransaction = Transaction<Database>;

async function replaceLocalAliases(
  trx: LocalTransaction,
  systemId: string,
  aliases: string[] | undefined,
): Promise<void> {
  if (!Array.isArray(aliases)) return;
  await trx.deleteFrom('system_aliases').where('system_id', '=', systemId).execute();
  const bySlug = new Map<string, string>();
  for (const alias of aliases) {
    const cleanAlias = alias.trim();
    const aliasSlug = slugifyCatalogSegment(cleanAlias);
    if (cleanAlias && aliasSlug && !bySlug.has(aliasSlug)) bySlug.set(aliasSlug, cleanAlias);
  }
  const clean = [...bySlug].map(([aliasSlug, alias]) => ({ alias, aliasSlug }));
  if (clean.length === 0) return;
  await trx.insertInto('system_aliases').values(clean.map(({ alias, aliasSlug }) => ({
    system_id: systemId,
    alias,
    alias_slug: aliasSlug,
    is_official: false,
  }))).execute();
}

function assertLocalParent(
  input: CatalogNodeInput,
  parent: { id: string; node_type: SystemNodeType; path_slug: string | null } | null,
): void {
  if (input.node_type === 'system') {
    if (input.parent_id) throw new Error('root_parent_forbidden');
    return;
  }
  if (!input.parent_id || !parent) throw new Error('parent_not_found');
  if (validateSystemParentType(input.node_type, parent.node_type) !== null) {
    throw new Error('hierarchy_invalid');
  }
}

function depthForType(nodeType: SystemNodeType): number {
  if (nodeType === 'system') return 0;
  if (nodeType === 'edition') return 1;
  if (nodeType === 'variant') return 2;
  throw new Error('bad_node_type');
}

function collectDescendantIds(rootId: string, byParent: Map<string, string[]>): Set<string> {
  const found = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of byParent.get(current) ?? []) {
      if (found.has(child)) throw new Error('hierarchy_cycle');
      found.add(child);
      queue.push(child);
    }
  }
  return found;
}

async function requireLocalNode(id: string): Promise<MesasSystemNode> {
  const node = (await loadLocalFlat()).find((item) => item.id === id);
  if (!node) throw new Error('system_not_found');
  return node;
}

function cleanOptional(value: string | null | undefined): string | null {
  const clean = value?.trim() ?? '';
  return clean || null;
}

async function loadLocalTree(): Promise<MesasSystemNode[]> {
  const flat = await loadLocalFlat();
  const byId = new Map(flat.map((node) => [node.id, { ...node, children: [] as MesasSystemNode[] }]));
  const roots: MesasSystemNode[] = [];

  for (const node of byId.values()) {
    if (!node.parent_id) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(node.parent_id);
    if (!parent) {
      throw new Error(`system_catalog_local_orphan:${node.id}:${node.parent_id}`);
    }
    parent.children.push(node);
  }

  return roots;
}
