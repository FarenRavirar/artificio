import { z } from 'zod';

// Extraido de apps/mesas/backend/src/services/catalogClient.ts e
// apps/glossario/backend/src/services/catalogClient.ts (achado Sonar de
// duplicacao cross-app, PR #145): fetch autenticado ao catalogo central
// (apps/site) + schemas zod da resposta da API sao identicos entre os dois
// apps consumidores. Cada app mantem sua propria logica de arvore/flat/cache
// (formatos de saida diferentes o bastante pra nao valer unificar).

export const catalogAliasSchema = z.object({ alias: z.string() });

export const catalogNodeTypeSchema = z.enum(['system', 'edition', 'variant', 'subsystem']);

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
