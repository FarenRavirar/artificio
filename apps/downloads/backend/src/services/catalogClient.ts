import { catalogFetch } from '@artificio/catalog-client';
import { z } from 'zod';

// Downloads acessa o catalogo central da spec 062 via @artificio/catalog-client
// (packages/catalog-client) — mesmo pacote ja usado por apps/mesas e
// apps/glossario. Spec 086 (Fase 4) implementou escrita: createCatalogNode/
// addCatalogNodeAlias, usadas SO por routes/systemSuggestionsAdmin.ts (approve),
// nunca pelo scraper.
//
// Correcao de debito documental (spec 086, 2026-07-25): a versao anterior deste
// comentario afirmava "consome (nunca escreve) [...] escrita de sistema/edicao
// continua proibida aqui", citando D097 — leitura errada da decisao. D097
// ("catalogo central, administracao distribuida") e D099 dizem o oposto:
// sistemas/edicoes podem ser administrados a partir de mesas, glossario OU
// downloads, sempre pelo mesmo servico/API/permissoes/auditoria, e "todos leem
// e escrevem integralmente nele, sem bancos/projecoes locais do catalogo". O
// que D097 reserva ao admin do site e a gestao PRINCIPAL/completa (hub
// administrativo), nao a exclusividade de escrita.
//
// Modelo alvo de escrita em Downloads (decisao do mantenedor, spec 086), igual
// ao que apps/mesas ja opera em producao: usuario comum SUGERE, admin aprova/
// recusa/ajusta numa tela de gestao — nunca escrita direta e cega no catalogo
// canonico. Contrato de referencia em mesas: POST /api/v1/system-suggestions
// (auth user) para sugerir; GET /api/v1/admin/system-suggestions,
// GET .../{id}/candidates (casamento com node existente),
// PATCH .../{id}/approve, PATCH .../{id}/reject e POST .../{id}/resolve
// (auth admin) para triagem. Downloads replica esse fluxo em vez de criar node
// direto a partir de dado raspado de marketplace.

const catalogAliasSchema = z.object({ alias: z.string() });

const catalogNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_pt: z.string().nullable().optional(),
  slug: z.string(),
  node_type: z.enum(['system', 'edition', 'variant']),
  aliases: z.array(catalogAliasSchema).optional(),
});

export type CatalogNode = z.infer<typeof catalogNodeSchema>;

export async function getCatalogNodeById(id: string): Promise<CatalogNode | null> {
  try {
    const node = await catalogFetch<unknown>(`/api/catalog/v1/nodes/${encodeURIComponent(id)}`);
    return catalogNodeSchema.parse(node);
  } catch {
    return null;
  }
}

// T4.3 (spec 086, Fase 4) — snapshot completo do catalogo, usado pela
// triagem admin (scoreSystemCandidates) e pelo auto-match automatico do
// scraperIngest (matchSystemNameExact). Formato flat: name/name_pt/slug/
// path_slug/node_type/parent_id/aliases, achatado a partir da arvore
// devolvida por GET /api/catalog/v1/systems (mesmo endpoint que mesas/
// glossario ja consomem via loadCatalogTree).
const catalogTreeNodeBaseSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  node_type: z.enum(['system', 'edition', 'variant']),
  canonical_slug: z.string(),
  path_slug: z.string(),
  name: z.string(),
  name_pt: z.string().nullable(),
  aliases: z.array(catalogAliasSchema),
});

type CatalogTreeNode = z.infer<typeof catalogTreeNodeBaseSchema> & { children: CatalogTreeNode[] };

const catalogTreeNodeSchema: z.ZodType<CatalogTreeNode> = catalogTreeNodeBaseSchema.extend({
  children: z.lazy(() => z.array(catalogTreeNodeSchema)),
});

const catalogSnapshotSchema = z.object({ tree: z.array(catalogTreeNodeSchema) });

export interface FlatCatalogSystem {
  id: string;
  name: string;
  name_pt: string | null;
  slug: string;
  path_slug: string;
  node_type: 'system' | 'edition' | 'variant';
  parent_id: string | null;
  aliases: string[];
}

function flattenSnapshotTree(nodes: CatalogTreeNode[]): FlatCatalogSystem[] {
  const flat: FlatCatalogSystem[] = [];
  const visit = (node: CatalogTreeNode) => {
    flat.push({
      id: node.id,
      name: node.name,
      name_pt: node.name_pt,
      slug: node.canonical_slug,
      path_slug: node.path_slug,
      node_type: node.node_type,
      parent_id: node.parent_id,
      aliases: node.aliases.map((alias) => alias.alias),
    });
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return flat;
}

const CATALOG_SNAPSHOT_CACHE_TTL_MS = 60 * 1000;
let snapshotCache: { data: FlatCatalogSystem[]; expiresAt: number } | null = null;

// T5.2 tambem depende deste cache (resolucao de sistema/edicao/variante em
// lote no card, sem N+1) — mesmo TTL/formato usado aqui pela Fase 4.
export async function loadCatalogSystemsFlat(forceRefresh = false): Promise<FlatCatalogSystem[]> {
  const now = Date.now();
  if (!forceRefresh && snapshotCache && snapshotCache.expiresAt > now) {
    return snapshotCache.data;
  }

  const raw = await catalogFetch<unknown>('/api/catalog/v1/systems');
  const snapshot = catalogSnapshotSchema.parse(raw);
  const flat = flattenSnapshotTree(snapshot.tree);
  snapshotCache = { data: flat, expiresAt: now + CATALOG_SNAPSHOT_CACHE_TTL_MS };
  return flat;
}

export function invalidateCatalogSnapshotCache(): void {
  snapshotCache = null;
}

const catalogNodeWriteResponseSchema = catalogTreeNodeBaseSchema;

export interface CatalogNodeCreateInput {
  name: string;
  name_pt?: string | null;
  node_type: 'system' | 'edition' | 'variant';
  parent_id?: string | null;
  aliases?: string[];
}

function slugifyCatalogSegment(value: string): string {
  const collapsed = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll('&', ' e ')
    .replace(/[^a-z0-9]+/g, '-');
  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed[start] === '-') start += 1;
  while (end > start && collapsed[end - 1] === '-') end -= 1;
  return collapsed.slice(start, end).slice(0, 80);
}

// T4.9 — escrita no catalogo central so por acao admin na triagem (nunca
// pelo scraper direto, requisito 8). Chamado so por
// routes/systemSuggestionsAdmin.ts (approve), no espirito de
// recordSystemEntityRule do mesas: aprovacao ensina o sistema, registrando
// o raw_value como alias do node escolhido.
export async function createCatalogNode(input: CatalogNodeCreateInput): Promise<FlatCatalogSystem> {
  const created = catalogNodeWriteResponseSchema.parse(await catalogFetch<unknown>('/api/admin/v1/catalog/nodes', {
    method: 'POST',
    body: JSON.stringify({
      parent_id: input.parent_id ?? null,
      node_type: input.node_type,
      canonical_slug: slugifyCatalogSegment(input.name),
      name: input.name,
      name_pt: input.name_pt ?? null,
      aliases: input.aliases ?? [],
    }),
  }));
  invalidateCatalogSnapshotCache();
  return {
    id: created.id,
    name: created.name,
    name_pt: created.name_pt,
    slug: created.canonical_slug,
    path_slug: created.path_slug,
    node_type: created.node_type,
    parent_id: created.parent_id,
    aliases: created.aliases.map((alias) => alias.alias),
  };
}

// T4.9 — registra raw_value como alias de um node ja existente (merge_existing/
// create_alias). PUT nao pode mandar aliases:[] quando so quer ADICIONAR um
// alias novo sem apagar os existentes (mesmo achado do CodeRabbit PR #145 no
// catalogClient do mesas) — busca os aliases atuais do node antes de decidir
// o payload final. node_type/name reenviados porque parseNodeWrite do site
// exige os dois no PUT mesmo quando so a lista de aliases muda.
export async function addCatalogNodeAlias(nodeId: string, alias: string): Promise<void> {
  const node = await getCatalogNodeById(nodeId);
  if (!node) {
    throw new Error(`catalog_node_not_found: ${nodeId}`);
  }
  const existingAliases = (node.aliases ?? []).map((a) => a.alias);
  if (existingAliases.includes(alias)) return;

  await catalogFetch<unknown>(`/api/admin/v1/catalog/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      node_type: node.node_type,
      name: node.name,
      aliases: [...existingAliases, alias],
    }),
  });
  invalidateCatalogSnapshotCache();
}
