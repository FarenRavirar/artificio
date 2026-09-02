import { useCallback } from 'react';
import { authGet } from '../utils/authenticatedFetch';
import { normalizeSystemsResponse } from './useSystemsCatalog';
import type { SystemTreeNode } from '../types/systems';

/**
 * Busca server-side do catálogo de sistemas (`GET /api/v1/systems`).
 *
 * **Fonte única das duas chamadas sob demanda** — `?search=` e `?parent_id=` —
 * usadas hoje pelo editor de mesa (`IdentityPart`, R18/A21 da spec 096) e, a
 * partir da fase G da spec 099, pelo editor de perfil (G5b).
 *
 * Extraído em 2026-09-01 ao implementar a G5b. O código nasceu dentro do
 * `IdentityPart`; copiá-lo para o perfil seria a terceira cópia do mesmo
 * conceito neste app e reprovaria por §Compartilhado por padrão — ainda mais
 * porque o que se copiaria não é o `fetch` trivial, e sim as duas correções
 * caras que ele carrega (o filtro de raízes e a margem do limite, comentadas
 * abaixo). Cópia sem essas duas linhas parece funcionar e erra em silêncio.
 *
 * O hook devolve `SystemTreeNode` (contrato do `mesas`); a conversão para o nó
 * do pacote acontece no `SystemPicker`, que é a fronteira.
 */

/**
 * Limite da busca server-side de sistemas (R18/A21). 5 é o número medido na
 * spec 096: `?search=vampiro&limit=5` devolve 423 bytes contra 503.907 do
 * `?view=tree` — o suficiente para uma coluna de opções sem despejar o
 * catálogo inteiro.
 */
export const SYSTEM_SEARCH_LIMIT = 5;
/** Margem sobre o exibido: a resposta traz níveis que a coluna Sistema descarta. */
export const SYSTEM_SEARCH_FETCH_LIMIT = 25;

export interface UseSystemsSearchReturn {
  /** `GET /systems?search=` — só raízes, prontas para a coluna Sistema. */
  fetchSystemOptions: (query: string, signal: AbortSignal) => Promise<SystemTreeNode[]>;
  /** `GET /systems?parent_id=` — filhos diretos de um nó. */
  fetchChildOptions: (parentId: string, signal: AbortSignal) => Promise<SystemTreeNode[]>;
  /**
   * `GET /systems?id=a,b,c` — resolve NOMES de ids já salvos, numa requisição.
   *
   * É o que torna a busca sob demanda viável em tela de seleção múltipla: sem
   * isto, quem já escolheu sistemas precisaria do catálogo inteiro só para
   * exibir os nomes do que escolheu — e aí a economia da busca seria nenhuma.
   * A rota já aceitava lista (`parseIdList`, systems.ts:105) e devolve só o que
   * existe: id que sumiu do catálogo some da resposta em vez de virar erro.
   */
  fetchSystemsByIds: (ids: string[], signal: AbortSignal) => Promise<SystemTreeNode[]>;
}

export function useSystemsSearch(): UseSystemsSearchReturn {
  // `useCallback` estabiliza a referência — os componentes do pacote guardam a
  // função e não refazem busca por re-render (contrato documentado lá).
  const fetchSystemOptions = useCallback(
    async (query: string, signal: AbortSignal): Promise<SystemTreeNode[]> => {
      // O `limit` pedido é MAIOR que o exibido de propósito: o servidor corta
      // antes de sabermos quais nós são raiz, e sem margem uma busca cujos
      // primeiros resultados são edições devolveria a coluna vazia.
      const params = new URLSearchParams({
        search: query,
        limit: String(SYSTEM_SEARCH_FETCH_LIMIT),
      });
      const response = await authGet(`/api/v1/systems?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error('Falha ao buscar sistemas.');
      }
      const json: unknown = await response.json();
      // Só RAÍZES nesta coluna: `?search=` achata a árvore filtrada
      // (`flattenTree(filterCatalogTree(...))` em systems.ts), então a resposta
      // mistura edições e variantes que casaram. Sem este filtro, buscar "5e"
      // listava o nó de edição ao lado do D&D como se fosse sistema — escolhê-lo
      // pulava um nível e a coluna "Edição" passava a exibir variantes.
      return normalizeSystemsResponse(json)
        .filter((node) => node.parent_id === null)
        .slice(0, SYSTEM_SEARCH_LIMIT);
    },
    [],
  );

  const fetchChildOptions = useCallback(
    async (parentId: string, signal: AbortSignal): Promise<SystemTreeNode[]> => {
      const params = new URLSearchParams({ parent_id: parentId });
      const response = await authGet(`/api/v1/systems?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error('Falha ao carregar opções do sistema.');
      }
      const json: unknown = await response.json();
      return normalizeSystemsResponse(json);
    },
    [],
  );

  const fetchSystemsByIds = useCallback(
    async (ids: string[], signal: AbortSignal): Promise<SystemTreeNode[]> => {
      if (ids.length === 0) return [];
      // `limit` acompanha a quantidade pedida: o default da rota é menor que
      // uma seleção grande, e sem isto os últimos ids voltariam cortados —
      // o usuário veria alguns nomes e outros não, sem explicação.
      const params = new URLSearchParams({
        id: ids.join(','),
        limit: String(ids.length),
      });
      const response = await authGet(`/api/v1/systems?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error('Falha ao carregar os sistemas selecionados.');
      }
      const json: unknown = await response.json();
      return normalizeSystemsResponse(json);
    },
    [],
  );

  return { fetchSystemOptions, fetchChildOptions, fetchSystemsByIds };
}
