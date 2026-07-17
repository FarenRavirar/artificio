import { z } from 'zod';
import { db } from '../db/index.js';
import type { SystemNodeType } from '../db/types.js';
import {
  catalogAliasSchema,
  catalogNodeTypeSchema,
  catalogFetch,
  archiveCatalogNode as sharedArchiveCatalogNode,
  flattenTree as sharedFlattenTree,
} from '@artificio/catalog-client';

// Achado Sonar (PR #145): import+export separado de simbolo nao usado
// localmente e so re-exportado — convencao pede `export ... from` direto.
export { checkCatalogHealth, type CatalogHealth } from '@artificio/catalog-client';

// Wrapper local: alem do PUT status=rejected do pacote compartilhado, mesas
// precisa invalidar seu proprio cache de arvore (treeCache) apos o archive.
export async function archiveCatalogNode(id: string): Promise<void> {
  await sharedArchiveCatalogNode(id);
  invalidateCatalogCache();
}

type CatalogNodeType = SystemNodeType;

// Achado Sonar duplicacao cross-app (PR #145): schemas/fetch/health/archive
// idênticos entre mesas e glossario extraidos para @artificio/catalog-client.
// Cada app mantém sua própria lógica de árvore/flat/cache (formatos de saída
// diferentes o bastante pra não valer unificar).

// Achado Sonar duplicacao (PR #145): campos base extraidos uma vez e reusados
// tanto pela arvore (com `children` recursivo via lazy) quanto pelo schema de
// resposta de escrita (catalogNodeWriteResponseSchema, sem `children`).
const catalogNodeBaseSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  node_type: catalogNodeTypeSchema,
  canonical_slug: z.string(),
  path_slug: z.string(),
  name: z.string(),
  name_pt: z.string().nullable(),
  description: z.string().nullable(),
  official_website_url: z.string().nullable(),
  logo_media_id: z.string().nullable(),
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
  node_type: CatalogNodeType;
  canonical_slug: string;
  path_slug: string;
  name: string;
  name_pt: string | null;
  description: string | null;
  official_website_url: string | null;
  logo_media_id: string | null;
  aliases: CatalogAlias[];
  children: CatalogTreeNode[];
}

const catalogSnapshotSchema = z.object({ tree: z.array(catalogTreeNodeSchema) });

// Achado CodeRabbit (PR #145): createCatalogNode/updateCatalogNode validavam
// a resposta de POST/PUT com catalogTreeNodeSchema (exige `children`), mas o
// endpoint de escrita do site (POST/PUT /api/admin/v1/catalog/nodes) retorna
// CatalogNodeRow — linha flat do banco, sem `children` (so a arvore/snapshot
// publica tem esse campo). O parse falhava sempre em runtime real. Schema
// proprio para resposta de escrita, reusando catalogNodeBaseSchema (sem
// `children`); normalizado com children: [] logo apos o parse.
const catalogNodeWriteResponseSchema = catalogNodeBaseSchema;

export interface MesasSystemNode {
  id: string;
  name: string;
  name_pt: string | null;
  slug: string;
  parent_id: string | null;
  node_type: CatalogNodeType;
  depth: number;
  path_slug: string | null;
  description: string | null;
  logo_filename: string | null;
  website_url: string | null;
  aliases: string[];
  has_children: boolean;
  children_count: number;
  tables_count: number;
  aliases_count: number;
  children: MesasSystemNode[];
}

export interface CatalogNodeInput {
  name: string;
  name_pt?: string | null;
  description?: string | null;
  node_type: CatalogNodeType;
  parent_id?: string | null;
  aliases?: string[];
  logo_filename?: string | null;
  website_url?: string | null;
}

const CATALOG_CACHE_TTL_MS = 60 * 1000;

let treeCache: { data: MesasSystemNode[]; expiresAt: number } | null = null;

export const invalidateCatalogCache = (): void => {
  treeCache = null;
};

// Achado Sonar (PR #145): /^-+|-+$/g tem altern\u00e2ncia de quantificadores gulosos
// nas duas pontas \u2014 trocado por trim manual de hifens (sem regex, sem backtracking).
export const slugifyCatalogSegment = (value: string): string => {
  const collapsed = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll('&', ' e ')
    .replace(/[^a-z0-9]+/g, '-');
  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed[start] === '-') start += 1;
  while (end > start && collapsed[end - 1] === '-') end -= 1;
  return collapsed.slice(start, end).slice(0, 80);
};

// Achado durante revisao PR #145: rotas publicas criticas (GET /tables, filtro
// ?system= e busca por nome) dependiam hard deste fetch. Catalogo indisponivel
// e cache expirado derrubava a rota inteira com 500. Se o fetch falhar e ainda
// houver cache expirado, serve o cache velho (stale) em vez de propagar erro;
// sem nenhum cache disponivel, retorna arvore vazia (degradacao graciosa).
export async function loadCatalogTree(forceRefresh = false): Promise<MesasSystemNode[]> {
  const now = Date.now();
  if (!forceRefresh && treeCache && treeCache.expiresAt > now) {
    return treeCache.data;
  }

  try {
    const rawSnapshot = await catalogFetch<unknown>('/api/catalog/v1/systems');
    const snapshot = catalogSnapshotSchema.parse(rawSnapshot);
    const tableCounts = await loadLocalTableCounts();
    const tree = snapshot.tree.map((node) => toMesasNode(node, 0, tableCounts));
    treeCache = { data: tree, expiresAt: now + CATALOG_CACHE_TTL_MS };
    return tree;
  } catch (error) {
    console.error('[loadCatalogTree] Catálogo indisponível:', error);
    if (treeCache) {
      return treeCache.data;
    }
    return [];
  }
}

export async function loadCatalogFlat(forceRefresh = false): Promise<MesasSystemNode[]> {
  return flattenTree(await loadCatalogTree(forceRefresh));
}

export async function createCatalogNode(input: CatalogNodeInput): Promise<MesasSystemNode> {
  const created = catalogNodeWriteResponseSchema.parse(await catalogFetch<unknown>('/api/admin/v1/catalog/nodes', {
    method: 'POST',
    body: JSON.stringify(toCatalogInput(input)),
  }));
  invalidateCatalogCache();
  const tableCounts = await loadLocalTableCounts();
  return toMesasNode({ ...created, children: [] }, depthFromPath(created.path_slug), tableCounts);
}

export async function updateCatalogNode(id: string, input: CatalogNodeInput): Promise<MesasSystemNode | null> {
  // Achado CodeRabbit (PR #145): PUT nao pode mandar aliases:[] quando o campo
  // nao veio no input — o site trata array (mesmo vazio) como replace explicito
  // e apaga todos os aliases existentes. So inclui o campo quando foi enviado.
  const { aliases, ...body } = toCatalogInput(input);
  const payload = Array.isArray(input.aliases) ? { ...body, aliases } : body;
  const updated = catalogNodeWriteResponseSchema.parse(await catalogFetch<unknown>(`/api/admin/v1/catalog/nodes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }));
  invalidateCatalogCache();
  const tableCounts = await loadLocalTableCounts();
  return toMesasNode({ ...updated, children: [] }, depthFromPath(updated.path_slug), tableCounts);
}

export function filterCatalogTree(nodes: MesasSystemNode[], search: string): MesasSystemNode[] {
  const normalizedSearch = normalizeText(search);

  const visit = (node: MesasSystemNode): MesasSystemNode | null => {
    const filteredChildren = node.children
      .map(visit)
      .filter((child): child is MesasSystemNode => Boolean(child));

    const matchesSelf =
      normalizeText(node.name).includes(normalizedSearch)
      || normalizeText(node.slug).includes(normalizedSearch)
      || normalizeText(node.path_slug ?? '').includes(normalizedSearch)
      || node.aliases.some((alias) => normalizeText(alias).includes(normalizedSearch));

    if (!matchesSelf && filteredChildren.length === 0) return null;
    return { ...node, children: filteredChildren, has_children: node.children_count > 0 };
  };

  return nodes.map(visit).filter((node): node is MesasSystemNode => Boolean(node));
}

export const flattenTree = sharedFlattenTree<MesasSystemNode>;

async function loadLocalTableCounts(): Promise<Map<string, number>> {
  const rows = await db
    .selectFrom('tables')
    .select(({ fn }) => ['system_id', fn.count<number>('id').as('count')])
    .where('system_id', 'is not', null)
    .groupBy('system_id')
    .execute();

  return new Map(rows.map((row) => [row.system_id!, Number(row.count ?? 0)]));
}

function toMesasNode(node: CatalogTreeNode, depth: number, tableCounts: Map<string, number>): MesasSystemNode {
  const children = node.children.map((child) => toMesasNode(child, depth + 1, tableCounts));
  const aliases = node.aliases.map((alias) => alias.alias);
  return {
    id: node.id,
    name: node.name,
    name_pt: node.name_pt,
    slug: node.canonical_slug,
    parent_id: node.parent_id,
    node_type: node.node_type,
    depth,
    path_slug: node.path_slug,
    description: node.description,
    logo_filename: node.logo_media_id,
    website_url: node.official_website_url,
    aliases,
    has_children: children.length > 0,
    children_count: children.length,
    tables_count: tableCounts.get(node.id) ?? 0,
    aliases_count: aliases.length,
    children,
  };
}

function toCatalogInput(input: CatalogNodeInput): Record<string, unknown> {
  return {
    parent_id: input.parent_id || null,
    node_type: input.node_type,
    canonical_slug: slugifyCatalogSegment(input.name),
    name: input.name,
    name_pt: input.name_pt ?? null,
    description: input.description ?? null,
    official_website_url: input.node_type === 'system' ? input.website_url ?? null : null,
    logo_media_id: input.node_type === 'system' ? input.logo_filename ?? null : null,
    // Achado CodeRabbit (PR #145): defesa em profundidade — chamadores internos
    // (systemSuggestionsAdmin.ts) tambem passam por aqui sem passar pela
    // normalizacao de systems.ts. Filtra item nao-string antes de enviar.
    aliases: Array.isArray(input.aliases)
      ? input.aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      : [],
  };
}

function depthFromPath(pathSlug: string): number {
  return pathSlug.split('/').filter(Boolean).length - 1;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}
