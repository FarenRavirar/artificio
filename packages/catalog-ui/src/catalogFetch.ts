import type { CatalogUiNode } from './types.js';

/**
 * Contrato de fonte server-side do catálogo, compartilhado por
 * `CatalogSystemSelector` (single-select) e `CatalogTree` (single e multi).
 *
 * Por que este arquivo existe (spec 099, fase G — G7): os tipos e o
 * normalizador nasceram dentro do `CatalogSystemSelector`, que **importa** de
 * `CatalogTree.tsx` (`filterRoots`, `findPath`, …). Quando o `CatalogTree`
 * passou a oferecer o mesmo contrato de fetch, importar de volta fecharia um
 * ciclo entre os dois módulos. A saída é a que o AGENTS.md pede — o que dois
 * consumidores precisam sobe para um lugar só, em vez de ser copiado — e o
 * ganho é maior que evitar o ciclo: passa a existir **uma** definição do que é
 * "fonte server-side de catálogo" neste pacote, não duas que podem divergir.
 */

/** Debounce da busca server-side de sistemas: evita uma chamada por tecla,
 * sem depender do consumidor montar o próprio debounce. */
export const SYSTEM_SEARCH_DEBOUNCE_MS = 250;

/** Fonte server-side de opções do nível sistema (R18/A21): o consumidor monta
 * a chamada real (ex.: GET /systems?search=<query>&limit=N) e devolve os nós.
 * O pacote NÃO inventa chamada HTTP — só consome o fetch que recebe. */
export type CatalogSystemSearchFetch = (
  query: string,
  signal: AbortSignal,
) => Promise<CatalogUiNode[]>;

/** Fonte server-side de filhos de um nó (R18/A21): o consumidor monta a chamada
 * real (ex.: GET /systems?parent_id=<parent.id>) e devolve os filhos diretos.
 * Devolver lista vazia significa "sem filhos" — a coluna não aparece. */
export type CatalogSystemChildrenFetch = (
  parent: CatalogUiNode,
  signal: AbortSignal,
) => Promise<CatalogUiNode[]>;

/** Fonte server-side do CAMINHO de um nó já selecionado (R18/A21): o consumidor
 * devolve a linhagem raiz→nó (ex.: [sistema, edição, variante]) do id recebido.
 * Existe para o consumidor NÃO precisar carregar a árvore inteira só para
 * reconstituir a seleção pré-existente — sem ela, `tree` volta a ser necessária
 * nesse caso. Lista vazia = id desconhecido. */
export type CatalogSystemPathFetch = (
  selectedId: string,
  signal: AbortSignal,
) => Promise<CatalogUiNode[]>;

/**
 * Nó vindo do fetch do consumidor é `unknown` na prática: o tipo é promessa de
 * compilação, e a resposta atravessa HTTP/JSON. Sem esta checagem, resposta que
 * não é array quebra em `.filter`, e nó sem `name`/`children` derruba o render
 * dentro de `nodeMatchesQuery` (`normalizeText(undefined)`) ou da navegação.
 */
function isCatalogUiNode(value: unknown): value is CatalogUiNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  return (
    typeof node.id === 'string' &&
    typeof node.name === 'string' &&
    typeof node.canonical_slug === 'string'
  );
}

/**
 * Descarta o que não é nó válido em vez de deixar o render quebrar.
 *
 * Recursivo de propósito: `subtreeMatchesQuery` desce em `children` e chama
 * `normalizeText(child.name)`, então um descendente malformado quebra a busca
 * mesmo com o nó de topo íntegro. Os campos opcionais que a busca lê
 * (`aliases`, `name_pt`, `path_slug`) também são checados por tipo — vindos de
 * HTTP, "string" é promessa de compilação, não garantia.
 */
export function normalizeNodes(value: unknown): CatalogUiNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCatalogUiNode).map((node) => ({
    ...node,
    name_pt: typeof node.name_pt === 'string' ? node.name_pt : null,
    path_slug: typeof node.path_slug === 'string' ? node.path_slug : null,
    aliases: Array.isArray(node.aliases)
      ? node.aliases.filter((alias): alias is string => typeof alias === 'string')
      : undefined,
    // `children` é obrigatório no tipo e percorrido sem guard na navegação.
    children: normalizeNodes(node.children),
  }));
}
