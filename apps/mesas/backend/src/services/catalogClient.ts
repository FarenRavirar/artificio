import { z } from 'zod';
import { db } from '../db';
import type { SystemNodeType } from '../db/types';

type CatalogNodeType = SystemNodeType;

// Achado CodeRabbit (PR #145): `res.json() as T` mascarava divergencia de shape
// do site (fonte externa) e permitia .map/.children recursivo sobre payload
// nao validado. Schemas zod substituem a validacao estrutural manual anterior.
const catalogAliasSchema = z.object({ alias: z.string() });

const catalogNodeTypeSchema = z.enum(['system', 'edition', 'variant', 'subsystem']);

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

export async function checkCatalogHealth(): Promise<CatalogHealth> {
  return catalogHealthSchema.parse(await catalogFetch<unknown>('/api/catalog/v1/health'));
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

export async function archiveCatalogNode(id: string): Promise<void> {
  await catalogFetch<unknown>(`/api/admin/v1/catalog/nodes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'rejected' }),
  });
  invalidateCatalogCache();
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

export function flattenTree(nodes: MesasSystemNode[]): MesasSystemNode[] {
  const flat: MesasSystemNode[] = [];
  const visit = (node: MesasSystemNode) => {
    flat.push({ ...node, children: [] });
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return flat;
}

// Achado Codex (PR #145): tables.system_id agora referencia o catalogo central
// (migration_144 dropou a FK local), mas 8 pontos de leitura ainda faziam
// leftJoin('systems' LOCAL) pra hidratar system_name/system_slug/system_path e
// filtrar por ?system=slug — sempre NULL/vazio pra mesas criadas/editadas pelo
// fluxo novo (system_suggestions -> catalogo central). Os dois helpers abaixo
// substituem esse join local: resolveSystemIdBySlug para o filtro de entrada,
// hydrateTableSystemFields para preencher os campos de saida a partir do
// catalogo central (cache de 60s via loadCatalogFlat).
// Achado durante revisao PR #145: mesmo risco do fallback de
// hydrateTableSystemFields — sem try/catch, catalogo indisponivel derrubava
// toda a rota GET /tables (filtro ?system=slug) com 500 em vez de so ignorar
// o filtro de sistema.
export async function resolveSystemIdBySlug(slug: string): Promise<string | null> {
  let flat: Awaited<ReturnType<typeof loadCatalogFlat>>;
  try {
    flat = await loadCatalogFlat();
  } catch (error) {
    console.error('[resolveSystemIdBySlug] Catálogo indisponível:', error);
    return null;
  }
  const node = flat.find((n) => n.slug === slug || n.path_slug === slug);
  return node?.id ?? null;
}

export type TableSystemFields = {
  system_name: string | null;
  system_slug: string | null;
  system_path: string | null;
  system_logo_filename: string | null;
  system_website_url: string | null;
};

const EMPTY_SYSTEM_FIELDS: TableSystemFields = {
  system_name: null,
  system_slug: null,
  system_path: null,
  system_logo_filename: null,
  system_website_url: null,
};

// Achado CodeRabbit (PR #145): rotas criticas (GET /gm/tables, /gm/insights,
// /tables) dependiam hard do catalogo central via este helper. Se o catalogo
// cair e o cache de loadCatalogFlat expirar, a hidratacao lancava e a rota
// inteira respondia 500 mesmo com os dados da mesa ja lidos do banco local.
// Fallback gracioso: retorna campos de sistema null em vez de propagar erro.
export async function hydrateTableSystemFields<T extends { system_id: string | null }>(
  rows: T[],
): Promise<Array<T & TableSystemFields>> {
  let flat: Awaited<ReturnType<typeof loadCatalogFlat>>;
  try {
    flat = await loadCatalogFlat();
  } catch (error) {
    console.error('[hydrateTableSystemFields] Catálogo indisponível, retornando sem campos de sistema:', error);
    return rows.map((row) => ({ ...row, ...EMPTY_SYSTEM_FIELDS }));
  }
  const byId = new Map(flat.map((node) => [node.id, node]));
  return rows.map((row) => {
    const node = row.system_id ? byId.get(row.system_id) : undefined;
    return {
      ...row,
      system_name: node?.name ?? null,
      system_slug: node?.slug ?? null,
      system_path: node?.path_slug ?? null,
      system_logo_filename: node?.logo_filename ?? null,
      system_website_url: node?.website_url ?? null,
    };
  });
}

// Achado CodeRabbit (PR #145): fetch sem timeout podia deixar rotas do mesas
// penduradas indefinidamente numa falha/lentidao do site central.
const CATALOG_FETCH_TIMEOUT_MS = 8000;

async function catalogFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.CATALOG_API_URL || process.env.CENTRAL_CATALOG_URL || process.env.SITE_API_URL;
  if (!baseUrl) {
    throw new Error('CATALOG_API_URL ausente');
  }

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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`catalog_${res.status}: ${body.slice(0, 300)}`);
  }
  return await res.json() as T;
}

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
