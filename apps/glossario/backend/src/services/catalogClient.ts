import { z } from 'zod';
import {
  catalogAliasSchema,
  catalogFetch,
  archiveCatalogNode as sharedArchiveCatalogNode,
  flattenTree,
} from '@artificio/catalog-client';

// Achado Sonar (PR #145): import+export separado de simbolo nao usado
// localmente e so re-exportado — convencao pede `export ... from` direto.
export { checkCatalogHealth, type CatalogHealth } from '@artificio/catalog-client';

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

// Achado Sonar duplicacao (PR #145): campos base extraidos uma vez e reusados
// tanto pela arvore (com `children` recursivo via lazy) quanto pelo schema de
// resposta de escrita (catalogNodeWriteResponseSchema, sem `children`).
const catalogNodeBaseSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  node_type: z.enum(['system', 'edition', 'variant']),
  canonical_slug: z.string(),
  path_slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'pending', 'active', 'rejected', 'merged']),
  aliases: z.array(catalogAliasSchema),
});

const catalogTreeNodeSchema: z.ZodType<CatalogTreeNode> = z.lazy(() => catalogNodeBaseSchema.extend({
  children: z.array(catalogTreeNodeSchema),
}));

interface CatalogAlias {
  alias: string;
}

interface CatalogTreeNode {
  id: string;
  parent_id: string | null;
  node_type: 'system' | 'edition' | 'variant';
  canonical_slug: string;
  path_slug: string;
  name: string;
  description: string | null;
  status: 'draft' | 'pending' | 'active' | 'rejected' | 'merged';
  aliases: CatalogAlias[];
  children: CatalogTreeNode[];
}

const catalogSnapshotSchema = z.object({ tree: z.array(catalogTreeNodeSchema) });

// Achado CodeRabbit (PR #145): writeCatalogNode validava a resposta de
// POST/PUT com catalogTreeNodeSchema (que exige `children`), mas o endpoint
// de escrita do site (POST/PUT /api/admin/v1/catalog/nodes) retorna
// CatalogNodeRow — a linha flat do banco, sem `children` (só a arvore/
// snapshot publica tem esse campo). O parse falhava sempre em runtime real.
// Schema proprio para resposta de escrita, reusando catalogNodeBaseSchema
// (sem `children`); normalizado para CatalogTreeNode (com children: [])
// apos o parse.
const catalogNodeWriteResponseSchema = catalogNodeBaseSchema;

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
  // Achado durante extracao de flattenTree para @artificio/catalog-client:
  // node.children populado no item achatado era comportamento so do glossario
  // (mesas ja zerava children:[] no flat). Migrando para o generico
  // compartilhado, children some do item achatado — filtra por parent_id em
  // vez de node.children para nao depender de arvore populada dentro do flat.
  const { flat } = await loadSnapshot();
  const parentExists = flat.some((node) => node.id === systemId);
  if (!parentExists) return [];
  return flat
    .filter((node) => node.parent_id === systemId && node.node_type === 'edition')
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
  node_type: 'system' | 'edition' | 'variant';
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

// Wrapper local: alem do PUT status=rejected do pacote compartilhado,
// glossario precisa invalidar seu proprio cache de snapshot apos o archive.
export async function archiveCatalogNode(id: string): Promise<void> {
  await sharedArchiveCatalogNode(id);
  invalidateCatalogCache();
}

// Achado durante revisao PR #145: mesas ja tinha fallback gracioso (serve
// cache stale se o catalogo cair, senao arvore vazia) em loadCatalogTree;
// glossario propagava o erro direto, derrubando listCatalogSystems/
// listCatalogEditions/getCatalogNameMap/etc com 500 sempre que o catalogo
// central ficasse indisponivel e o cache expirasse. Mesmo padrao aplicado
// aqui por consistencia entre os dois consumidores do catalogo central.
async function loadSnapshot(): Promise<{ tree: CatalogTreeNode[]; flat: CatalogTreeNode[] }> {
  const now = Date.now();
  if (snapshotCache && snapshotCache.expiresAt > now) return snapshotCache;
  try {
    const snapshot = catalogSnapshotSchema.parse(await catalogFetch<unknown>('/api/catalog/v1/systems'));
    const flat = flattenTree(snapshot.tree);
    snapshotCache = { tree: snapshot.tree, flat, expiresAt: now + CACHE_TTL_MS };
    return snapshotCache;
  } catch (error) {
    console.error('[loadSnapshot] Catálogo indisponível:', error);
    if (snapshotCache) return snapshotCache;
    return { tree: [], flat: [] };
  }
}

async function writeCatalogNode(input: CatalogNodeInput, method: 'POST' | 'PUT', path: string): Promise<CatalogTreeNode> {
  const row = catalogNodeWriteResponseSchema.parse(await catalogFetch<unknown>(path, {
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
  return { ...row, children: [] };
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
