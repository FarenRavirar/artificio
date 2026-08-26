import { z } from 'zod';

// Extraido de apps/mesas/backend/src/services/catalogClient.ts e
// apps/glossario/backend/src/services/catalogClient.ts (achado Sonar de
// duplicacao cross-app, PR #145): fetch autenticado ao catalogo central
// (apps/site) + schemas zod da resposta da API sao identicos entre os dois
// apps consumidores. Cada app mantem sua propria logica de arvore/flat/cache
// (formatos de saida diferentes o bastante pra nao valer unificar).

export const catalogAliasSchema = z.object({ alias: z.string() });

export const catalogNodeTypeSchema = z.enum(['system', 'edition', 'variant']);

export interface CatalogAlias {
  alias: string;
}

export interface CatalogHealth {
  ok: boolean;
  catalog_version: number;
  nodes_count: number;
  checksum: string;
}

export const catalogHealthSchema = z.object({
  ok: z.boolean(),
  catalog_version: z.number(),
  nodes_count: z.number(),
  checksum: z.string(),
});

// Achado CodeRabbit (PR #145): fetch sem timeout podia deixar rotas dos
// backends consumidores penduradas indefinidamente numa falha/lentidao do
// site central.
export const CATALOG_FETCH_TIMEOUT_MS = 8000;

export interface CatalogFetchOptions extends RequestInit {
  baseUrl?: string;
  token?: string;
}

// Achado CodeRabbit (PR #145): `res.json() as T` mascarava divergencia de
// shape do site (fonte externa). Chamador aplica o schema zod apropriado
// sobre o retorno; este helper so cuida de transporte/timeout/erro HTTP.
export async function catalogFetch<T>(path: string, options: CatalogFetchOptions = {}): Promise<T> {
  const { baseUrl: baseUrlOverride, token: tokenOverride, ...init } = options;
  const baseUrl = baseUrlOverride
    ?? process.env.CATALOG_API_URL
    ?? process.env.CENTRAL_CATALOG_URL
    ?? process.env.SITE_API_URL;
  if (!baseUrl) {
    throw new Error('CATALOG_API_URL ausente');
  }

  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const token = tokenOverride ?? process.env.CATALOG_INTERNAL_TOKEN;
  if (token) headers.set('x-artificio-catalog-token', token);

  const timeoutSignal = AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

  const res = await fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers,
    signal,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`catalog_${res.status}: ${body.slice(0, 300)}`);
  }
  return await res.json() as T;
}

export async function checkCatalogHealth(options: CatalogFetchOptions = {}): Promise<CatalogHealth> {
  return catalogHealthSchema.parse(await catalogFetch<unknown>('/api/catalog/v1/health', options));
}

/**
 * Resposta de escrita do catálogo central (`POST/PUT /api/admin/v1/catalog/nodes`).
 *
 * T7.1c (spec 096): a LEITURA subiu para cá na spec 062, a ESCRITA ficou para
 * trás — `mesas` e `downloads` mantinham cada um a sua cópia de
 * `createCatalogNode`, falando com a MESMA rota e validando contratos
 * diferentes: o `mesas` exigia `description`, `official_website_url` e
 * `logo_media_id`; o `downloads` não os declarava. Contrato de rota tem um dono
 * só. Os campos que só um app usa são opcionais aqui, para que nenhum dos dois
 * quebre com a resposta que o outro já recebe.
 */
export const catalogNodeWriteResponseSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  node_type: catalogNodeTypeSchema,
  canonical_slug: z.string(),
  path_slug: z.string(),
  name: z.string(),
  name_pt: z.string().nullable(),
  // `.default(null)` em vez de `.optional()`: a rota do site sempre devolve os
  // três (é o que o schema do `mesas` já validava, sem optional, em produção),
  // mas o `downloads` nem os declarava. O default normaliza a saída para os dois
  // — quem consome recebe `null`, nunca `undefined`, e nenhum app precisa
  // conhecer a omissão do outro.
  description: z.string().nullable().default(null),
  official_website_url: z.string().nullable().default(null),
  logo_media_id: z.string().nullable().default(null),
  aliases: z.array(catalogAliasSchema),
});

export type CatalogNodeWriteResponse = z.infer<typeof catalogNodeWriteResponseSchema>;

export interface CatalogNodeCreateInput {
  name: string;
  name_pt?: string | null;
  node_type: z.infer<typeof catalogNodeTypeSchema>;
  parent_id?: string | null;
  aliases?: string[];
  description?: string | null;
  /** Só faz sentido em `node_type: 'system'` — o corpo o anula nos demais. */
  website_url?: string | null;
  /** Idem: identidade visual é do sistema, não da edição/variante. */
  logo_filename?: string | null;
}

/**
 * Corpo do POST/PUT, comum aos dois verbos.
 *
 * Achado CodeRabbit (PR #145), preservado na subida: os aliases são filtrados
 * aqui como defesa em profundidade — chamadores internos (a aprovação de
 * sugestão de sistema) não passam pela normalização das rotas de catálogo, e um
 * item não-string chegaria ao site central.
 */
function toCatalogNodeBody(input: CatalogNodeCreateInput): Record<string, unknown> {
  const isSystem = input.node_type === 'system';
  return {
    parent_id: input.parent_id || null,
    node_type: input.node_type,
    canonical_slug: slugifyCatalogSegment(input.name),
    name: input.name,
    name_pt: input.name_pt ?? null,
    description: input.description ?? null,
    official_website_url: isSystem ? input.website_url ?? null : null,
    logo_media_id: isSystem ? input.logo_filename ?? null : null,
    aliases: Array.isArray(input.aliases)
      ? input.aliases.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      : [],
  };
}

/**
 * Slug de um segmento do caminho canônico.
 *
 * Reúne os dois achados que estavam separados, cada um numa cópia:
 * - PR #145 (Sonar, `mesas`): sem `/^-+|-+$/g` — alternância de quantificadores
 *   gulosos nas duas pontas; o trim manual não tem backtracking.
 * - PR #204 (Codex, `downloads`): truncar em 80 DEPOIS de tirar os hífens das
 *   pontas podia deixar hífen sobrando (o corte cai num separador) — daí o trim
 *   final.
 *
 * `&` vira " e " porque é o que o `mesas` faz e o que o catálogo central espera
 * ("D&D" → "d-e-d", não "d-d"); a cópia do `downloads` não fazia essa tradução e
 * gerava slug diferente para o mesmo nome — divergência resolvida aqui, no dono
 * do contrato.
 */
export function slugifyCatalogSegment(value: string): string {
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

/**
 * Cria um nó no catálogo central e devolve a resposta validada.
 *
 * Só transporte + contrato: a invalidação de cache e a conversão para o formato
 * de nó de cada app continuam no app, porque são de fato diferentes (o `mesas`
 * anexa contagem de mesas, o `downloads` devolve um nó achatado).
 */
export async function createCatalogNode(
  input: CatalogNodeCreateInput,
  options: CatalogFetchOptions = {},
): Promise<CatalogNodeWriteResponse> {
  return catalogNodeWriteResponseSchema.parse(
    await catalogFetch<unknown>('/api/admin/v1/catalog/nodes', {
      ...options,
      method: 'POST',
      body: JSON.stringify(toCatalogNodeBody(input)),
    }),
  );
}

/**
 * Atualiza um nó existente.
 *
 * Achado CodeRabbit (PR #145), preservado na subida: o PUT não pode mandar
 * `aliases: []` quando o campo não veio no input — o site trata array (mesmo
 * vazio) como replace explícito e apagaria todos os aliases existentes.
 */
export async function updateCatalogNode(
  id: string,
  input: CatalogNodeCreateInput,
  options: CatalogFetchOptions = {},
): Promise<CatalogNodeWriteResponse> {
  const { aliases, ...body } = toCatalogNodeBody(input);
  const payload = Array.isArray(input.aliases) ? { ...body, aliases } : body;

  return catalogNodeWriteResponseSchema.parse(
    await catalogFetch<unknown>(`/api/admin/v1/catalog/nodes/${encodeURIComponent(id)}`, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  );
}

export async function archiveCatalogNode(id: string, options: CatalogFetchOptions = {}): Promise<void> {
  await catalogFetch<unknown>(`/api/admin/v1/catalog/nodes/${encodeURIComponent(id)}`, {
    ...options,
    method: 'PUT',
    body: JSON.stringify({ status: 'rejected' }),
  });
}

// Achado: mesas (flattenTree) e glossario (flatten, privado) tinham a mesma
// visita recursiva pai->filhos, so mudando o tipo do no — mas com um
// comportamento divergente: mesas zerava children:[] no item achatado,
// glossario mantinha children populado (do qual listCatalogEditions
// dependia). Padronizado em children:[] (comportamento mesas, decisao do
// mantenedor); glossario.listCatalogEditions foi ajustado para filtrar por
// parent_id em vez de depender de children populado no item achatado.
export function flattenTree<T extends { children: T[] }>(nodes: T[]): T[] {
  const flat: T[] = [];
  const visit = (node: T) => {
    flat.push({ ...node, children: [] });
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return flat;
}
