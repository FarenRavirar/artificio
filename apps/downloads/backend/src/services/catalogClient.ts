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

// Achado real (review PR #204, Codex, P1): GET /api/catalog/v1/nodes/:idOrSlug
// (apps/site/server/catalog-api.ts) devolve CatalogNodeRow — campo real é
// canonical_slug, nunca slug. catalogNodeSchema exigia slug: todo parse
// falhava, caía no catch e getCatalogNodeById sempre devolvia null, fazendo
// addCatalogNodeAlias (approve merge_existing/create_alias) sempre lançar
// catalog_node_not_found mesmo com o node existindo de verdade.
const catalogNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_pt: z.string().nullable().optional(),
  canonical_slug: z.string(),
  parent_id: z.string().nullable().optional(),
  node_type: z.enum(['system', 'edition', 'variant']),
  aliases: z.array(catalogAliasSchema).optional(),
});

export type CatalogNode = z.infer<typeof catalogNodeSchema>;

// Achado real (review PR #204, Codex): catch genérico tratava QUALQUER falha
// (timeout, 500, DNS) como "node não existe" — addCatalogNodeAlias então
// lançava catalog_node_not_found mesmo em falha transitória de rede,
// mascarando o erro real. catalogFetch formata erro HTTP como
// "catalog_<status>: <body>" (packages/catalog-client); só 404 vira null
// aqui, qualquer outro erro (rede/5xx) propaga pro chamador como falha real.
export async function getCatalogNodeById(id: string): Promise<CatalogNode | null> {
  try {
    const node = await catalogFetch<unknown>(`/api/catalog/v1/nodes/${encodeURIComponent(id)}`);
    return catalogNodeSchema.parse(node);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('catalog_404')) {
      return null;
    }
    throw error;
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

const catalogMaterialTypeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  status: z.enum(['pending', 'active', 'merged', 'rejected']),
});

const catalogMaterialTypesResponseSchema = z.object({
  items: z.array(catalogMaterialTypeSchema),
});

export type CatalogMaterialType = z.infer<typeof catalogMaterialTypeSchema>;

const MATERIAL_TYPES_ROLLOUT_FALLBACK: CatalogMaterialType[] = [{
  id: 'b071ab5e-2d16-4c58-8f0e-086000000001',
  slug: 'aventura',
  name: 'Aventura',
  aliases: ['adventure', 'aventuras'],
  status: 'active',
}];

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

// Achado real (review PR #204, Codex, P1): resolver um node folha (edition/
// variant) direto em system_id quebra os dois filtros de routes/materials.ts
// (`system_id` filtra só a raiz, `edition_id` filtra o resto — material
// casado numa edição sumia do filtro por sistema raiz e nunca aparecia no
// filtro por edição). Compartilhado entre scraperIngest.ts (auto-match) e
// routes/systemSuggestionsAdmin.ts (triagem admin) — mesma regra nos dois
// pontos que gravam taxonomia em download_material.
export function resolveTaxonomyIds(matchedId: string, catalogNodes: FlatCatalogSystem[]): { systemId: string; editionId: string | null } {
  const byId = new Map(catalogNodes.map((node) => [node.id, node]));
  let current = byId.get(matchedId);
  while (current && current.node_type !== 'system' && current.parent_id) {
    current = byId.get(current.parent_id);
  }
  const systemId = current?.id ?? matchedId;
  const editionId = systemId === matchedId ? null : matchedId;
  return { systemId, editionId };
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

  const raw = await catalogFetch<unknown>('/api/catalog/v1/snapshot');
  const snapshot = catalogSnapshotSchema.parse(raw);
  const flat = flattenSnapshotTree(snapshot.tree);
  snapshotCache = { data: flat, expiresAt: now + CATALOG_SNAPSHOT_CACHE_TTL_MS };
  return flat;
}

export function invalidateCatalogSnapshotCache(): void {
  snapshotCache = null;
}

/**
 * IDs de nodes da taxonomia cujo nome casa com o termo buscado (spec 087,
 * achado de review PR #214). Serve a busca textual da listagem publica, que
 * precisa aceitar "D&D" ou "Tormenta" e devolver material daquele sistema.
 *
 * Roda sobre o snapshot ja cacheado, em memoria: a taxonomia nao tem tabela
 * local pra join SQL, e ir na rede a cada busca seria caro e fragil.
 *
 * Casa contra name, name_pt, slug E aliases — os aliases sao exatamente o
 * vocabulario alternativo que o publico usa ("dnd", "5e"), entao ignora-los
 * faria a busca falhar justamente nos termos mais digitados.
 *
 * Fail-soft: Catalogo Central fora do ar degrada a busca pra titulo/autor em
 * vez de derrubar a listagem publica inteira com 500.
 */
export async function matchTaxonomyIdsByName(term: string): Promise<string[]> {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  let nodes: FlatCatalogSystem[];
  try {
    nodes = await loadCatalogSystemsFlat();
  } catch (error: unknown) {
    console.error('[catalog] busca por sistema indisponível:', error instanceof Error ? error.message : error);
    return [];
  }

  return nodes
    .filter((node) => {
      const haystack = [node.name, node.name_pt, node.slug, ...node.aliases];
      return haystack.some((value) => value?.toLowerCase().includes(needle));
    })
    .map((node) => node.id);
}

let materialTypesCache: { data: CatalogMaterialType[]; expiresAt: number } | null = null;

export async function loadCatalogMaterialTypes(forceRefresh = false): Promise<CatalogMaterialType[]> {
  const now = Date.now();
  if (!forceRefresh && materialTypesCache && materialTypesCache.expiresAt > now) {
    return materialTypesCache.data;
  }

  let data: CatalogMaterialType[];
  try {
    const raw = await catalogFetch<unknown>('/api/catalog/v1/material-types');
    data = catalogMaterialTypesResponseSchema.parse(raw).items;
  } catch (error: unknown) {
    // Achado real (review PR #205, Codex, P1): Site e Downloads têm deploy
    // isolado/dispatch-only. Se Downloads subir primeiro, a versão anterior do
    // Site responde 404 nesta rota e bloquearia criação humana + ingest inteiro.
    // O bootstrap usa exatamente o UUID/valor da migration 015/028 até o Site
    // receber o contrato; somente rota ausente aceita fallback. Rede/5xx/schema
    // inválido continuam falhando para não mascarar indisponibilidade Central.
    if (error instanceof Error && error.message.startsWith('catalog_404')) {
      data = MATERIAL_TYPES_ROLLOUT_FALLBACK;
    } else {
      throw error;
    }
  }
  materialTypesCache = { data, expiresAt: now + CATALOG_SNAPSHOT_CACHE_TTL_MS };
  return data;
}

export function invalidateCatalogMaterialTypesCache(): void {
  materialTypesCache = null;
}

export async function getCatalogMaterialTypeById(id: string): Promise<CatalogMaterialType | null> {
  const materialTypes = await loadCatalogMaterialTypes();
  return materialTypes.find((item) => item.id === id) ?? null;
}

export async function getCatalogMaterialTypeBySlug(slug: string): Promise<CatalogMaterialType | null> {
  const normalized = slug.trim().toLocaleLowerCase('pt-BR');
  const materialTypes = await loadCatalogMaterialTypes();
  return materialTypes.find((item) =>
    item.slug.toLocaleLowerCase('pt-BR') === normalized
    || item.aliases.some((alias) => alias.toLocaleLowerCase('pt-BR') === normalized),
  ) ?? null;
}

const catalogNodeWriteResponseSchema = catalogTreeNodeBaseSchema;

export interface CatalogNodeCreateInput {
  name: string;
  name_pt?: string | null;
  node_type: 'system' | 'edition' | 'variant';
  parent_id?: string | null;
  aliases?: string[];
}

// Achado real (review PR #204, Codex): truncar em 80 chars após remover
// hifens das pontas podia deixar hifen trailing de volta (corte no meio de
// um separador). Trim final garante canonical_slug nunca termina em hifen.
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
  const truncated = collapsed.slice(start, end).slice(0, 80);
  return truncated.replace(/-+$/, '');
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

// Spec 088 (achado de review PR #218, Codex P2) — escrita de TIPO no catalogo
// central, mesma regra da escrita de sistema: so por acao admin na triagem,
// nunca pelo scraper (requisito 8). Chamado so por
// routes/materialTypeSuggestionsAdmin.ts.
//
// O contrato do Site (catalog-material-types-admin-api.ts) e mais simples que o
// de nodes: POST exige `name` e deriva o slug quando ausente; PUT e um PATCH
// parcial de verdade (so toca as chaves presentes no corpo), entao mandar
// apenas `aliases` nao apaga name/slug/status.
export async function createCatalogMaterialType(name: string, aliases: string[] = []): Promise<CatalogMaterialType> {
  const created = catalogMaterialTypeSchema.parse(await catalogFetch<unknown>('/api/admin/v1/catalog/material-types', {
    method: 'POST',
    body: JSON.stringify({ name, aliases, status: 'active' }),
  }));
  invalidateCatalogMaterialTypesCache();
  return created;
}

// Achado de review PR #218 (Codex, P2) — compensacao de tipo orfao, equivalente
// a archiveCatalogNode do fluxo de sistema. Se o POST central concluir e a
// escrita local (applyResolution) falhar depois, a transacao do Downloads
// reverte e a sugestao volta a 'pending', mas o tipo recem-criado continua no
// catalogo central: o retry colidiria no slug UNIQUE e devolveria 500 pra
// sempre, travando a fila. `merged` (nao `rejected`) porque e o status que
// `listMaterialTypes` filtra fora sem sugerir juizo sobre o valor — o tipo nao
// foi recusado por um humano, so nunca chegou a existir de fato.
export async function archiveCatalogMaterialType(materialTypeId: string): Promise<void> {
  await catalogFetch<unknown>(`/api/admin/v1/catalog/material-types/${encodeURIComponent(materialTypeId)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'merged' }),
  });
  invalidateCatalogMaterialTypesCache();
}

// Aprovar merge_existing ENSINA o vocabulario, senao o mesmo raw_value volta
// pra fila em todo reprocessamento.
//
// Achado de review PR #218 (Codex, P2): a primeira versao lia os aliases atuais
// e reenviava a lista concatenada (`aliases: [...atuais, novo]`), o mesmo
// read-modify-write que addCatalogNodeAlias faz no fluxo de sistema. Duas
// aprovacoes simultaneas pro MESMO tipo liam a mesma lista e a ultima gravacao
// apagava o alias da primeira — as duas sugestoes ficavam 'approved', mas so um
// alias sobrevivia, e o raw_value perdido voltava pra fila na proxima ingestao.
// `add_aliases` (apps/site) concatena DENTRO do UPDATE, sem janela entre ler e
// escrever, e deduplica em SQL. Nao ha mais leitura previa pra ficar obsoleta.
export async function addCatalogMaterialTypeAlias(materialTypeId: string, alias: string): Promise<void> {
  await catalogFetch<unknown>(`/api/admin/v1/catalog/material-types/${encodeURIComponent(materialTypeId)}`, {
    method: 'PUT',
    body: JSON.stringify({ add_aliases: [alias] }),
  });
  invalidateCatalogMaterialTypesCache();
}
