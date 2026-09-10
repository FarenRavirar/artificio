import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import { db } from '../db/index.js';
import type { Database, SystemNodeType } from '../db/types.js';
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
} from './catalogClient.js';
import { validateSystemParentType } from './systemHierarchy.js';

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
    return false;
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

/**
 * Nome do sistema com a cadeia inteira ("Dungeons & Dragons 5e 2024"), não só a
 * folha ("2024"), que sozinha não identifica nada.
 *
 * Exportada na spec 100 F6.3c: o perfil público do mestre passou a exibir os
 * sistemas de `user_systems` e precisa do MESMO nome que a mesa já mostra —
 * duas composições diferentes para a mesma entidade seria a divergência por
 * superfície que o monorepo existe para evitar.
 */
export function composeSystemDisplayName(node: MesasSystemNode, byId: Map<string, MesasSystemNode>): string {
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
    await assertNoEquivalentLocalSibling(trx, input);

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

/**
 * Recusa irmão semanticamente equivalente no catálogo LOCAL (spec 100 F6.3d,
 * achado de review na PR #310).
 *
 * **Este é o caminho que produziu o defeito.** `resolveSystemCatalogSource`
 * manda `APP_ENV=beta` para o provider local (linha 50), e
 * `docker-compose.beta.yml:57` define exatamente isso — então a guarda que
 * entrou no catálogo central (`apps/site/db/repo/catalog.ts`) protegia
 * produção, que a medição de F6.3e já mostrara **limpa**, e deixava aberta
 * justamente a fábrica de beta, onde nasceram as duas edições "5e" irmãs.
 * Guardar só um dos dois lados era guardar o lado errado.
 *
 * A comparação espelha `assertNoEquivalentSibling` de
 * `apps/site/db/repo/catalog.ts`. Espelho deliberado, não pacote compartilhado:
 * o site é o DONO do catálogo e os outros apps puxam dele — fazer o dono
 * importar um pacote do lado consumidor inverteria a direção da dependência.
 *
 * **Serialização:** `pg_advisory_xact_lock` sobre a chave do conjunto de irmãos,
 * a MESMA que o dono usa (`catalog_sibling:<pai|root>`, `apps/site/db/repo/catalog.ts`).
 * O `SELECT ... FOR UPDATE` no pai continua, porque também protege contra o pai
 * ser arquivado no meio da transação — mas ele sozinho não bastava: com
 * `parent_id` nulo não existe linha a travar, e o lock da rota de aprovação é
 * por `suggestion_id` (`systemSuggestionsAdmin.ts`), que não serializa DUAS
 * sugestões distintas. Duas aprovações simultâneas de "Vampire" e "Vampiro" na
 * raiz liam os mesmos irmãos antes de qualquer inserção, e como os slugs
 * diferem a unicidade de slug também não barrava — exatamente a duplicata que
 * esta guarda existe para impedir (achado de review na PR #310).
 */
async function assertNoEquivalentLocalSibling(
  trx: LocalTransaction,
  input: CatalogNodeInput,
): Promise<void> {
  const parentId = input.parent_id ?? null;

  // Trava o CONJUNTO de irmãos, não a linha do pai: é o que cobre a raiz, onde
  // não há pai para travar. Chave idêntica à do dono, em `apps/site`.
  await sql`select pg_advisory_xact_lock(hashtext(${`catalog_sibling:${parentId ?? 'root'}`}))`
    .execute(trx);

  if (parentId) {
    await trx.selectFrom('systems')
      .select('id')
      .where('id', '=', parentId)
      .forUpdate()
      .execute();
  }

  const irmaos = await trx.selectFrom('systems')
    .select(['id', 'name', 'name_pt'])
    .where((eb) => (parentId ? eb('parent_id', '=', parentId) : eb('parent_id', 'is', null)))
    .where('catalog_status', '=', 'active')
    .execute();

  if (irmaos.length === 0) return;

  const idsParaAlias = parentId ? [...irmaos.map((n) => n.id), parentId] : irmaos.map((n) => n.id);
  const aliasRows = await trx.selectFrom('system_aliases')
    .select(['system_id', 'alias'])
    .where('system_id', 'in', idsParaAlias)
    .execute();

  const aliasesPorNo = new Map<string, string[]>();
  for (const row of aliasRows) {
    const lista = aliasesPorNo.get(row.system_id);
    if (lista) lista.push(row.alias);
    else aliasesPorNo.set(row.system_id, [row.alias]);
  }

  const pai = parentId
    ? await trx.selectFrom('systems')
      .select(['id', 'name', 'name_pt'])
      .where('id', '=', parentId)
      .executeTakeFirst()
    : undefined;

  // Prefixos do mais longo para o mais curto: com "Vampire" e "Vampiro" na
  // lista, tirar o errado primeiro deixaria resto que não casa com nada.
  const chavesDoPai = pai
    ? [pai.name, pai.name_pt ?? '', ...(aliasesPorNo.get(pai.id) ?? [])]
      .map(normalizarIdentidadeDeCatalogo)
      .filter((chave) => chave.length > 0)
      .sort((a, b) => b.length - a.length)
    : [];

  const semPrefixoDoPai = (valor: string): string => {
    const chave = normalizarIdentidadeDeCatalogo(valor);
    for (const chaveDoPai of chavesDoPai) {
      if (chave === chaveDoPai) return chave;
      if (chave.startsWith(`${chaveDoPai} `)) return chave.slice(chaveDoPai.length + 1);
    }
    return chave;
  };

  const candidatas = new Set(
    [input.name, input.name_pt ?? '', ...(input.aliases ?? [])]
      .map(semPrefixoDoPai)
      .filter((chave) => chave.length > 0),
  );
  if (candidatas.size === 0) return;

  for (const irmao of irmaos) {
    const existentes = [irmao.name, irmao.name_pt ?? '', ...(aliasesPorNo.get(irmao.id) ?? [])]
      .map(semPrefixoDoPai);
    if (existentes.some((chave) => chave.length > 0 && candidatas.has(chave))) {
      throw new Error('duplicate_sibling_node');
    }
  }
}

/**
 * Identidade comparável de um nome de catálogo: minúsculas, sem acento e sem
 * pontuação. É o que faz `Vampiro` e `vampiro`, ou `D&D` e `d d`, colidirem.
 *
 * Espelha `normalizeCatalogIdentity` de `apps/site/db/repo/catalog.ts`, e a
 * duplicação é deliberada: o site é o DONO do catálogo e o `mesas` mantém um
 * espelho local para beta. Fazer o site importar um pacote do lado consumidor
 * inverteria a direção da dependência.
 */
function normalizarIdentidadeDeCatalogo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
    const tableReference = await trx.selectFrom('tables')
      .select('id')
      .where('system_id', '=', id)
      .executeTakeFirst();
    if (tableReference) throw new Error('archive_has_tables');
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
