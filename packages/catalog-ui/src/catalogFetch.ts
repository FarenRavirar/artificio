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
    typeof node.canonical_slug === 'string' &&
    // `parent_id` e `node_type` são obrigatórios no tipo e TÊM consumidor:
    // `CatalogExplorer` chama `nextChildType(parent.node_type)` ao descer um
    // nível, e `undefined` ali quebra a navegação com o nó já em tela. Aceitar
    // o nó incompleto aqui só adia o erro para longe da origem — e o valor vem
    // de HTTP, onde o tipo é promessa de compilação, não garantia.
    // Achado do CodeRabbit na PR #304.
    (node.parent_id === null || typeof node.parent_id === 'string') &&
    (node.node_type === 'system' || node.node_type === 'edition' || node.node_type === 'variant')
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
    // Os tres campos de EDICAO passavam pelo spread sem checagem. `CatalogNodeForm`
    // le cada um com `?? ''` e o entrega a um input controlado (CatalogNodeForm.tsx:31):
    // um objeto vindo do HTTP no lugar da string vira `value={{}}`, que o React nao
    // aceita como valor de input — e, se renderizasse, o admin salvaria `[object Object]`
    // de volta no catalogo. Mesma regra ja aplicada a `name_pt`/`path_slug` logo abaixo.
    // Achado do CodeRabbit.
    description: typeof node.description === 'string' ? node.description : null,
    official_website_url:
      typeof node.official_website_url === 'string' ? node.official_website_url : null,
    logo_media_id: typeof node.logo_media_id === 'string' ? node.logo_media_id : null,
    name_pt: typeof node.name_pt === 'string' ? node.name_pt : null,
    path_slug: typeof node.path_slug === 'string' ? node.path_slug : null,
    aliases: Array.isArray(node.aliases)
      ? node.aliases.filter((alias): alias is string => typeof alias === 'string')
      : undefined,
    // `children` é obrigatório no tipo e percorrido sem guard na navegação.
    children: normalizeNodes(node.children),
  }));
}
