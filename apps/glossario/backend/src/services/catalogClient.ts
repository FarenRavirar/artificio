import { z } from 'zod';

export interface GlossarioSystem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'aprovado';
  position: number;
}

export interface GlossarioEdition extends GlossarioSystem {
  system_id: string;
}

// Achado CodeRabbit (PR #145): `res.json() as T` mascarava divergencia de shape
// do site (fonte externa) e permitia .map/.children recursivo sobre payload
// nao validado. Schemas zod substituem a validacao estrutural manual anterior.
const catalogAliasSchema = z.object({ alias: z.string() });

const catalogTreeNodeSchema: z.ZodType<CatalogTreeNode> = z.lazy(() => z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  node_type: z.enum(['system', 'edition', 'subsystem', 'variant']),
  canonical_slug: z.string(),
  path_slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'pending', 'active', 'rejected', 'merged']),
  aliases: z.array(catalogAliasSchema),
  children: z.array(catalogTreeNodeSchema),
}));

interface CatalogAlias {
  alias: string;
}

interface CatalogTreeNode {
  id: string;
  parent_id: string | null;
  node_type: 'system' | 'edition' | 'subsystem' | 'variant';
  canonical_slug: string;
  path_slug: string;
  name: string;
  description: string | null;
  status: 'draft' | 'pending' | 'active' | 'rejected' | 'merged';
  aliases: CatalogAlias[];
  children: CatalogTreeNode[];
}

const catalogSnapshotSchema = z.object({ tree: z.array(catalogTreeNodeSchema) });

const catalogHealthSchema = z.object({
  ok: z.boolean(),
  catalog_version: z.number(),
  nodes_count: z.number(),
  checksum: z.string(),
});

export interface CatalogHealth {
  ok: boolean;
  catalog_version: number;
  nodes_count: number;
  checksum: string;
}

interface CatalogNodeInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  parent_id?: string | null;
  node_type: 'system' | 'edition';
  status?: 'pending' | 'active';
}

const CACHE_TTL_MS = 60 * 1000;

let snapshotCache: { tree: CatalogTreeNode[]; flat: CatalogTreeNode[]; expiresAt: number } | null = null;

export const invalidateCatalogCache = (): void => {
  snapshotCache = null;
};

export async function listCatalogSystems(): Promise<GlossarioSystem[]> {
  const { tree } = await loadSnapshot();
  return tree
    .filter((node) => node.node_type === 'system')
    .map((node, index) => toSystem(node, index));
}

export async function listCatalogEditions(systemId: string): Promise<GlossarioEdition[]> {
  const parent = (await loadSnapshot()).flat.find((node) => node.id === systemId);
  if (!parent) return [];
  return parent.children
    .filter((node) => node.node_type === 'edition')
    .map((node, index) => toEdition(node, index));
}

export async function findCatalogNode(id: string): Promise<CatalogTreeNode | undefined> {
  return (await loadSnapshot()).flat.find((node) => node.id === id);
}

export async function getCatalogNameMap(): Promise<Map<string, string>> {
  const { flat } = await loadSnapshot();
  return new Map(flat.map((node) => [node.id, node.name]));
}

export interface CatalogNodeIndexEntry {
  id: string;
  name: string;
  parent_id: string | null;
  node_type: 'system' | 'edition' | 'subsystem' | 'variant';
}

// Achado CodeRabbit (PR #145): script de migração cruzava edições só por nome
// normalizado, sem considerar o sistema pai — nomes repetidos (ex. "1ª Edição")
// em sistemas diferentes colidiam no mesmo UUID central. Índice traz parent_id
// pra montar chave composta (pai canônico + nome) na migração.
export async function getCatalogNodeIndex(): Promise<CatalogNodeIndexEntry[]> {
  const { flat } = await loadSnapshot();
  return flat.map((node) => ({
    id: node.id,
    name: node.name,
    parent_id: node.parent_id,
    node_type: node.node_type,
  }));
}

export async function checkCatalogHealth(): Promise<CatalogHealth> {
  return catalogHealthSchema.parse(await catalogFetch<unknown>('/api/catalog/v1/health'));
}

export async function createCatalogSystem(input: Omit<CatalogNodeInput, 'node_type' | 'parent_id'>): Promise<GlossarioSystem> {
  const created = await writeCatalogNode({ ...input, node_type: 'system', parent_id: null }, 'POST', '/api/admin/v1/catalog/nodes');
  invalidateCatalogCache();
  return toSystem(created, 0);
}

export async function updateCatalogSystem(id: string, input: Omit<CatalogNodeInput, 'node_type' | 'parent_id'>): Promise<GlossarioSystem> {
  const updated = await writeCatalogNode({ ...input, node_type: 'system', parent_id: null }, 'PUT', `/api/admin/v1/catalog/nodes/${encodeURIComponent(id)}`);
  invalidateCatalogCache();
  return toSystem(updated, 0);
}

export async function createCatalogEdition(systemId: string, input: Omit<CatalogNodeInput, 'node_type' | 'parent_id'>): Promise<GlossarioEdition> {
  const created = await writeCatalogNode({ ...input, node_type: 'edition', parent_id: systemId }, 'POST', '/api/admin/v1/catalog/nodes');
  invalidateCatalogCache();
  return toEdition(created, 0);
}

export async function updateCatalogEdition(id: string, input: Omit<CatalogNodeInput, 'node_type' | 'parent_id'>): Promise<GlossarioEdition> {
  // Achado CodeRabbit (PR #145): se findCatalogNode nao achasse o no, parent_id
  // virava null silenciosamente, quebrando o contrato hierarquico (edicao sem
  // pai). Exige no existente do tipo edition com pai valido antes de escrever.
  const existing = await findCatalogNode(id);
  if (existing?.node_type !== 'edition' || !existing.parent_id) {
    throw new Error('edition_not_found');
  }
  const updated = await writeCatalogNode({ ...input, node_type: 'edition', parent_id: existing.parent_id }, 'PUT', `/api/admin/v1/catalog/nodes/${encodeURIComponent(id)}`);
  invalidateCatalogCache();
  return toEdition(updated, 0);
}

export async function archiveCatalogNode(id: string): Promise<void> {
  await catalogFetch<unknown>(`/api/admin/v1/catalog/nodes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'rejected' }),
  });
  invalidateCatalogCache();
}

async function loadSnapshot(): Promise<{ tree: CatalogTreeNode[]; flat: CatalogTreeNode[] }> {
  const now = Date.now();
  if (snapshotCache && snapshotCache.expiresAt > now) return snapshotCache;
  const snapshot = catalogSnapshotSchema.parse(await catalogFetch<unknown>('/api/catalog/v1/systems'));
  const flat = flatten(snapshot.tree);
  snapshotCache = { tree: snapshot.tree, flat, expiresAt: now + CACHE_TTL_MS };
  return snapshotCache;
}

async function writeCatalogNode(input: CatalogNodeInput, method: 'POST' | 'PUT', path: string): Promise<CatalogTreeNode> {
  return catalogTreeNodeSchema.parse(await catalogFetch<unknown>(path, {
    method,
    body: JSON.stringify({
      parent_id: input.parent_id ?? null,
      node_type: input.node_type,
      canonical_slug: input.slug || undefined,
      name: input.name,
      description: input.description ?? null,
      // Achado CodeRabbit (PR #145): status hardcoded 'active' publicava direto
      // no catalogo compartilhado mesmo para membro comum (POST /api/systems
      // so bloqueia member em beta via betaWriteGuard, nao e gate de moderacao).
      // Caller decide: admin publica active, membro comum cria pending
      // (GET /api/catalog/v1/systems central filtra so status=active).
      status: input.status ?? 'pending',
    }),
  }));
}

// Achado CodeRabbit (PR #145): fetch sem timeout podia deixar controllers do
// glossario pendurados indefinidamente numa falha/lentidao do site central.
const CATALOG_FETCH_TIMEOUT_MS = 8000;

async function catalogFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.CATALOG_API_URL || process.env.CENTRAL_CATALOG_URL || process.env.SITE_API_URL;
  if (!baseUrl) throw new Error('CATALOG_API_URL ausente');

  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const token = process.env.CATALOG_INTERNAL_TOKEN;
  if (token) headers.set('x-artificio-catalog-token', token);

  const res = await fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers,
    signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`catalog_${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json() as T;
}

function flatten(nodes: CatalogTreeNode[]): CatalogTreeNode[] {
  const rows: CatalogTreeNode[] = [];
  const visit = (node: CatalogTreeNode) => {
    rows.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return rows;
}

function toSystem(node: CatalogTreeNode, position: number): GlossarioSystem {
  return {
    id: node.id,
    name: node.name,
    slug: node.canonical_slug,
    description: node.description,
    status: 'aprovado',
    position,
  };
}

function toEdition(node: CatalogTreeNode, position: number): GlossarioEdition {
  return {
    ...toSystem(node, position),
    system_id: node.parent_id ?? '',
  };
}
